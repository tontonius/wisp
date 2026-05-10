import * as THREE from "three";
import type { Particle, ParticleBackend, ParticleBackendOptions, ParticlePreset, Range, SimulationSpace, SoftParticleDepthTextureOptions, SortMode } from "../types";
import { DEFAULT_EMITTER, evaluateCurve, evaluateGradient, fbmNoise3, getTextureSheetConfig, isRendererDispersalEnabled, makeDispersalAmountCurveTexture, makeParticleMaterial, randomColor, randomRange, randomVec3, rangeMinMax, sampleEmitter, speedToParam, tempColorA, tempColorB, tempMatrixA, tempVectorA, tempVectorB, tempVectorC, tempVectorD } from "../shared";

export class CPUParticleBackend implements ParticleBackend {
  readonly object = new THREE.Object3D();
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;

  private particles: Particle[] = [];
  private positions: Float32Array;
  private uvs: Float32Array;
  private colors: Float32Array;
  private dispersalAttrs: Float32Array;
  private positionAttribute: THREE.BufferAttribute;
  private uvAttribute: THREE.BufferAttribute;
  private colorAttribute: THREE.BufferAttribute;
  private dispersalAttribute: THREE.BufferAttribute;
  private dispersalAmountCurveTexture: THREE.DataTexture | null = null;
  private maxParticles: number;
  private _elapsed = 0;
  private _aliveCount = 0;
  private emissionAccumulator = 0;
  private playing = false;
  private emissionComplete = false;
  private burstCursor = 0;
  private _disposed = false;
  private sortedBursts: Array<{ time: number; count: Range; probability?: number }>;
  private sortMode: SortMode;
  private simulationSpace: SimulationSpace;
  private sortIndices: number[];
  private sortKeys: Float32Array;
  private emitterVelocity = new THREE.Vector3();
  private lastEmitterWorldPosition = new THREE.Vector3();
  private hasLastEmitterWorldPosition = false;

  constructor(private preset: ParticlePreset, private backendOptions: ParticleBackendOptions = {}) {
    this.maxParticles = preset.maxParticles ?? 256;
    this.sortedBursts = [...(preset.emission?.bursts ?? [])].sort((a, b) => a.time - b.time);

    this.geometry = new THREE.BufferGeometry();
    const vertexCount = this.maxParticles * 6;
    this.positions = new Float32Array(vertexCount * 3);
    this.uvs = new Float32Array(vertexCount * 2);
    this.colors = new Float32Array(vertexCount * 4);
    this.dispersalAttrs = new Float32Array(vertexCount * 2);

    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.uvAttribute = new THREE.BufferAttribute(this.uvs, 2);
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 4);
    this.dispersalAttribute = new THREE.BufferAttribute(this.dispersalAttrs, 2);

    this.geometry.setAttribute("position", this.positionAttribute);
    this.geometry.setAttribute("uv", this.uvAttribute);
    this.geometry.setAttribute("particleColor", this.colorAttribute);
    this.geometry.setAttribute("particleDispersal", this.dispersalAttribute);
    this.geometry.setDrawRange(0, 0);

    if (isRendererDispersalEnabled(preset.renderer) && preset.renderer?.dispersal?.amount) {
      this.dispersalAmountCurveTexture = makeDispersalAmountCurveTexture(preset.renderer.dispersal.amount);
    }
    this.material = makeParticleMaterial(preset.renderer);
    if (this.dispersalAmountCurveTexture) {
      this.material.uniforms.uDispersalAmountCurve.value = this.dispersalAmountCurveTexture;
    }
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.object.add(this.mesh);

    this.sortMode = preset.renderer?.sorting ?? "distance";
    this.simulationSpace = preset.simulationSpace ?? "local";
    this.sortIndices = new Array(this.maxParticles);
    this.sortKeys = new Float32Array(this.maxParticles);

    for (let i = 0; i < this.maxParticles; i++) this.particles.push(this.createDeadParticle());
    if (preset.prewarm) this.prewarm();
  }

  get isAlive(): boolean {
    return this._aliveCount > 0;
  }

  get aliveCount(): number {
    return this._aliveCount;
  }

  get elapsed(): number {
    return this._elapsed;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get isComplete(): boolean {
    return this.emissionComplete && !this.isAlive;
  }

  get isDisposed(): boolean {
    return this._disposed;
  }

  play(): void {
    if (this._disposed) throw new Error("Cannot play a disposed ParticleSystem.");
    this.playing = true;
    this.emissionComplete = false;
  }

  pause(): void {
    this.playing = false;
  }

  stop({ clear = true } = {}): void {
    this.playing = false;
    this.emissionComplete = true;
    this._elapsed = 0;
    this.emissionAccumulator = 0;
    this.burstCursor = 0;

    if (clear) {
      for (const particle of this.particles) particle.alive = false;
      this._aliveCount = 0;
      this.geometry.setDrawRange(0, 0);
    }
  }

  restart(): void {
    this.stop({ clear: true });
    this.play();
  }

  emit(count: number): void {
    for (let i = 0; i < count; i++) this.spawnParticle();
  }

  setSoftParticleDepthTexture(depthTexture: THREE.Texture | null, options: SoftParticleDepthTextureOptions = {}): void {
    const u = this.material.uniforms;
    const image = depthTexture?.image as { width?: number; height?: number } | undefined;
    const width = options.width ?? image?.width ?? 1;
    const height = options.height ?? image?.height ?? 1;
    u.uSceneDepth.value = depthTexture;
    u.uSceneDepthSize.value.set(Math.max(1, width), Math.max(1, height));
    u.uSoftParticles.value = this.preset.renderer?.softParticles && depthTexture ? 1 : 0;
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this._disposed) return;

    const duration = this.preset.duration ?? 1;
    const loop = this.preset.loop ?? false;

    if (this.playing) {
      this._elapsed += dt;
      this.updateEmitterVelocity(dt);

      if (loop && this._elapsed > duration) {
        this._elapsed %= duration;
        this.burstCursor = 0;
        this.emissionComplete = false;
      }

      if (!loop && this._elapsed > duration) {
        this.playing = false;
        this.emissionComplete = true;
      } else {
        this.updateEmission(dt);
      }
    }

    this.updateSoftParticleCameraUniforms(camera);
    this.updateParticles(dt);
    this.updateGeometry(camera);
  }

  dispose({ disposeTexture = false } = {}): void {
    if (this._disposed) return;
    this.object.removeFromParent();
    this.geometry.dispose();

    const texture = this.material.uniforms.uTexture?.value as THREE.Texture | undefined;
    const dispersalMap = this.preset.renderer?.dispersal?.texture;
    this.material.dispose();
    if (disposeTexture && texture) texture.dispose();
    if (disposeTexture && dispersalMap && dispersalMap !== texture) dispersalMap.dispose();
    this.dispersalAmountCurveTexture?.dispose();

    this._disposed = true;
  }

  private createDeadParticle(): Particle {
    return {
      alive: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      age: 0,
      lifetime: 1,
      startSize: 1,
      startOpacity: 1,
      startColor: new THREE.Color("#ffffff"),
      rotation: 0,
      angularVelocity: 0,
      randomSeed: Math.random() * 1000,
      startFrame: 0,
    };
  }

  private prewarm(): void {
    const duration = this.preset.duration ?? 1;
    const step = 1 / 30;
    const dummyCamera = new THREE.PerspectiveCamera();
    dummyCamera.position.set(0, 0, 10);
    dummyCamera.lookAt(0, 0, 0);
    this.play();
    for (let t = 0; t < duration; t += step) this.update(step, dummyCamera);
    this._elapsed = 0;
    this.burstCursor = 0;
  }

  private updateSoftParticleCameraUniforms(camera: THREE.Camera): void {
    const u = this.material.uniforms;
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      u.uCameraNearFar.value.set(camera.near, camera.far);
    } else {
      u.uCameraNearFar.value.set(0.1, 1000);
    }
    u.uCameraIsPerspective.value = camera instanceof THREE.PerspectiveCamera ? 1 : 0;
    if (u.uDispersalTime) u.uDispersalTime.value = this._elapsed;
  }

  private updateEmission(dt: number): void {
    const rate = randomRange(this.preset.emission?.rateOverTime ?? 0);
    this.emissionAccumulator += rate * dt;

    while (this.emissionAccumulator >= 1) {
      this.spawnParticle();
      this.emissionAccumulator -= 1;
    }

    while (this.burstCursor < this.sortedBursts.length) {
      const burst = this.sortedBursts[this.burstCursor];
      if (this._elapsed < burst.time) break;
      if (Math.random() <= (burst.probability ?? 1)) this.emit(Math.floor(randomRange(burst.count)));
      this.burstCursor++;
    }
  }

  private spawnParticle(): void {
    const particle = this.particles.find((p) => !p.alive);
    if (!particle) return;

    const sample = sampleEmitter(this.preset.emitter ?? DEFAULT_EMITTER);
    const start = this.preset.start ?? {};

    particle.alive = true;
    this._aliveCount++;
    particle.position.copy(sample.position);
    particle.age = 0;
    particle.lifetime = Math.max(0.01, this.resolveSpawnLifetime(start));
    particle.velocity.copy(sample.direction).multiplyScalar(randomRange(start.speed ?? 1)).add(randomVec3(start.velocity ?? [0, 0, 0]));
    const inheritVelocity = this.preset.inheritVelocity;
    if (inheritVelocity?.factor !== undefined) {
      particle.velocity.addScaledVector(this.emitterVelocity, randomRange(inheritVelocity.factor));
    }
    particle.startSize = randomRange(start.size ?? 0.2);
    particle.startOpacity = randomRange(start.opacity ?? 1);
    particle.startColor.copy(randomColor(start.color ?? "#ffffff"));
    particle.rotation = THREE.MathUtils.degToRad(randomRange(start.rotation ?? 0));
    particle.angularVelocity = THREE.MathUtils.degToRad(randomRange(start.angularVelocity ?? 0));
    particle.randomSeed = Math.random() * 1000;

    const sheet = getTextureSheetConfig(this.preset);
    particle.startFrame = sheet?.randomFrame ? Math.floor(Math.random() * sheet.totalFrames) : 0;

    if (this.simulationSpace === "world") {
      this.object.updateWorldMatrix(true, false);
      particle.position.applyMatrix4(this.object.matrixWorld);
      tempMatrixA.copy(this.object.matrixWorld).setPosition(0, 0, 0);
      particle.velocity.applyMatrix4(tempMatrixA);
    }

    this.backendOptions.onParticleBirth?.(particle);
  }

  private resolveSpawnLifetime(start: NonNullable<ParticlePreset["start"]>): number {
    const baseLifetime = randomRange(start.lifetime ?? 1);
    const lbs = this.preset.lifetimeByEmitterSpeed;
    if (!lbs) return baseLifetime;
    const emitterSpeed = this.emitterVelocity.length();
    const t = speedToParam(emitterSpeed, lbs.speedRange);
    const [lifeMin, lifeMax] = rangeMinMax(lbs.lifetimeRange, baseLifetime);
    return THREE.MathUtils.lerp(lifeMin, lifeMax, t);
  }

  private updateEmitterVelocity(dt: number): void {
    if (dt <= 0) return;
    this.object.updateWorldMatrix(true, false);
    tempVectorA.setFromMatrixPosition(this.object.matrixWorld);
    if (!this.hasLastEmitterWorldPosition) {
      this.lastEmitterWorldPosition.copy(tempVectorA);
      this.emitterVelocity.set(0, 0, 0);
      this.hasLastEmitterWorldPosition = true;
      return;
    }
    this.emitterVelocity.copy(tempVectorA).sub(this.lastEmitterWorldPosition).multiplyScalar(1 / dt);
    if (this.simulationSpace === "local") {
      tempMatrixA.copy(this.object.matrixWorld).setPosition(0, 0, 0).invert();
      this.emitterVelocity.applyMatrix4(tempMatrixA);
    }
    this.lastEmitterWorldPosition.copy(tempVectorA);
  }

  private updateParticles(dt: number): void {
    const forces = this.preset.forces ?? {};
    const acceleration = tempVectorA.set(...(forces.acceleration ?? [0, 0, 0]));
    const drag = forces.drag ?? 0;
    const vortex = forces.vortex;
    const vortexCenter = vortex?.center ?? [0, 0, 0];
    const vortexAxis = tempVectorD.set(...(vortex?.axis ?? [0, 1, 0]));
    if (vortexAxis.lengthSq() < 1e-8) vortexAxis.set(0, 1, 0);
    else vortexAxis.normalize();
    const vortexOrbital = vortex?.orbitalSpeed ?? 0;
    const vortexInward = vortex?.inward ?? 0;
    const vortexUpward = vortex?.upward ?? 0;
    const noise = forces.noise;
    const noiseStrength = noise?.strength ?? 0;
    const noiseFrequency = noise?.frequency ?? 1;
    const noiseScroll = noise?.scroll ?? [0.2, 0.35, 0.17];
    const noiseOctaves = THREE.MathUtils.clamp(Math.floor(noise?.octaves ?? 2), 1, 4);
    const noiseLacunarity = Math.max(1, noise?.lacunarity ?? 2);
    const noisePersistence = THREE.MathUtils.clamp(noise?.persistence ?? 0.5, 0.05, 1);
    const pointAttractor = forces.pointAttractor;
    const paCenter = pointAttractor?.center ?? [0, 0, 0];
    const paEps = pointAttractor?.epsilon ?? 1e-4;

    for (const particle of this.particles) {
      if (!particle.alive) continue;

      particle.age += dt;
      if (particle.age >= particle.lifetime) {
        particle.alive = false;
        this._aliveCount = Math.max(0, this._aliveCount - 1);
        this.backendOptions.onParticleDeath?.(particle);
        continue;
      }

      particle.velocity.addScaledVector(acceleration, dt);

      if (pointAttractor) {
        const t = THREE.MathUtils.clamp(particle.age / particle.lifetime, 0, 1);
        const mult = evaluateCurve(pointAttractor.strengthOverLifetime, t, 1);
        const eff = (pointAttractor.strength ?? 0) * mult;
        if (eff !== 0) {
          const toCx = paCenter[0] - particle.position.x;
          const toCy = paCenter[1] - particle.position.y;
          const toCz = paCenter[2] - particle.position.z;
          const distSq = toCx * toCx + toCy * toCy + toCz * toCz;
          if (distSq > paEps * paEps) {
            const dist = Math.sqrt(distSq);
            const s = (eff * dt) / dist;
            particle.velocity.x += toCx * s;
            particle.velocity.y += toCy * s;
            particle.velocity.z += toCz * s;
          }
        }
      }

      if (vortexOrbital !== 0 || vortexInward !== 0 || vortexUpward !== 0) {
        const radial = tempVectorA.set(
          particle.position.x - vortexCenter[0],
          particle.position.y - vortexCenter[1],
          particle.position.z - vortexCenter[2]
        );
        const axialDist = radial.dot(vortexAxis);
        const radialPlane = tempVectorB.copy(radial).addScaledVector(vortexAxis, -axialDist);
        const radialLen = radialPlane.length();
        if (radialLen > 1e-5) {
          radialPlane.multiplyScalar(1 / radialLen);
          const tangent = tempVectorC.copy(vortexAxis).cross(radialPlane);
          if (tangent.lengthSq() > 1e-8) {
            tangent.normalize();
            if (vortexOrbital !== 0) particle.velocity.addScaledVector(tangent, vortexOrbital * dt);
          }
          if (vortexInward !== 0) particle.velocity.addScaledVector(radialPlane, -vortexInward * dt);
        }
        if (vortexUpward !== 0) particle.velocity.addScaledVector(vortexAxis, vortexUpward * dt);
      }

      if (noiseStrength > 0) {
        const f = noiseFrequency;
        const s = noiseStrength;
        const tNoise = this._elapsed;
        const px = particle.position.x * f + tNoise * noiseScroll[0] + particle.randomSeed * 0.01;
        const py = particle.position.y * f + tNoise * noiseScroll[1] + particle.randomSeed * 0.013;
        const pz = particle.position.z * f + tNoise * noiseScroll[2] + particle.randomSeed * 0.017;
        const nx = fbmNoise3(px + 17.1, py + 3.2, pz + 5.9, noiseOctaves, noiseLacunarity, noisePersistence) * 2 - 1;
        const ny = fbmNoise3(px - 11.4, py + 19.7, pz + 7.3, noiseOctaves, noiseLacunarity, noisePersistence) * 2 - 1;
        const nz = fbmNoise3(px + 4.8, py - 13.6, pz + 23.1, noiseOctaves, noiseLacunarity, noisePersistence) * 2 - 1;
        particle.velocity.x += nx * s * dt;
        particle.velocity.y += ny * s * dt;
        particle.velocity.z += nz * s * dt;
      }

      if (drag > 0) particle.velocity.multiplyScalar(Math.max(0, 1 - drag * dt));
      const t = THREE.MathUtils.clamp(particle.age / particle.lifetime, 0, 1);
      const over = this.preset.overLifetime ?? {};
      const velocityLimit = this.preset.limitVelocityOverLifetime;
      if (velocityLimit?.speed) {
        const maxSpeed = Math.max(0, evaluateCurve(velocityLimit.speed, t, Number.POSITIVE_INFINITY));
        const speedSq = particle.velocity.lengthSq();
        if (Number.isFinite(maxSpeed) && speedSq > maxSpeed * maxSpeed) {
          const speed = Math.sqrt(speedSq);
          const cappedVelocity = tempVectorD.copy(particle.velocity).multiplyScalar(maxSpeed / Math.max(speed, 1e-6));
          const dampen = THREE.MathUtils.clamp(velocityLimit.dampen ?? 1, 0, 1);
          particle.velocity.lerp(cappedVelocity, dampen);
        }
      }
      const simSpeed = particle.velocity.length();
      let sizeForCollision = evaluateCurve(over.size, t, 1);
      const sbs = this.preset.sizeBySpeed;
      if (sbs?.curve && sbs.speedRange) {
        sizeForCollision *= evaluateCurve(sbs.curve, speedToParam(simSpeed, sbs.speedRange), 1);
      }
      const particleVisualRadius = Math.max(0, particle.startSize * sizeForCollision * 0.5);
      const lifetimeVelocity = this.preset.velocityOverLifetime;
      const linearVelocity = tempVectorB.set(
        evaluateCurve(lifetimeVelocity?.linear?.x, t, 0),
        evaluateCurve(lifetimeVelocity?.linear?.y, t, 0),
        evaluateCurve(lifetimeVelocity?.linear?.z, t, 0)
      );
      particle.position.addScaledVector(tempVectorC.copy(particle.velocity).add(linearVelocity), dt);

      const collision = this.preset.collision;
      if (collision) {
        const eps = 1e-4;
        if (collision.type === "plane") {
          const planeY = collision.y ?? 0;
          const minY = planeY + particleVisualRadius + eps;
          if (particle.position.y < minY) {
            particle.position.y = minY;
            this.backendOptions.onParticleCollision?.(particle);
            if (collision.killOnCollision) {
              particle.alive = false;
              this._aliveCount = Math.max(0, this._aliveCount - 1);
              this.backendOptions.onParticleDeath?.(particle);
              continue;
            }
            const bounce = collision.bounce ?? 0.4;
            if (particle.velocity.y < 0) particle.velocity.y = -bounce * particle.velocity.y;
            const dampening = collision.dampening ?? 1;
            particle.velocity.x *= dampening;
            particle.velocity.z *= dampening;
          }
        } else if (collision.type === "sphere") {
          const center = collision.center ?? [0, 0, 0];
          const radius = Math.max(eps, collision.radius ?? 1);
          const contactRadius = radius + particleVisualRadius;
          const toParticle = tempVectorA.set(
            particle.position.x - center[0],
            particle.position.y - center[1],
            particle.position.z - center[2]
          );
          const distSq = toParticle.lengthSq();
          const radiusSq = contactRadius * contactRadius;
          if (distSq < radiusSq) {
            let dist = Math.sqrt(distSq);
            if (dist <= eps) {
              // Fallback when position is exactly at center.
              toParticle.copy(particle.velocity);
              if (toParticle.lengthSq() <= eps) toParticle.set(0, 1, 0);
              toParticle.normalize();
              dist = 0;
            } else {
              toParticle.multiplyScalar(1 / dist);
            }

            particle.position.set(
              center[0] + toParticle.x * (contactRadius + eps),
              center[1] + toParticle.y * (contactRadius + eps),
              center[2] + toParticle.z * (contactRadius + eps)
            );
            this.backendOptions.onParticleCollision?.(particle);
            if (collision.killOnCollision) {
              particle.alive = false;
              this._aliveCount = Math.max(0, this._aliveCount - 1);
              this.backendOptions.onParticleDeath?.(particle);
              continue;
            }

            const bounce = collision.bounce ?? 0.4;
            const dampening = collision.dampening ?? 1;
            const normalVelocity = particle.velocity.dot(toParticle);
            if (normalVelocity < 0) {
              particle.velocity.addScaledVector(toParticle, -(1 + bounce) * normalVelocity);
            }
            tempVectorB.copy(toParticle).multiplyScalar(particle.velocity.dot(toParticle));
            tempVectorC.copy(particle.velocity).sub(tempVectorB).multiplyScalar(dampening);
            particle.velocity.copy(tempVectorB).add(tempVectorC);
          }
        } else if (collision.type === "box") {
          const center = collision.center ?? [0, 0, 0];
          const size = collision.size ?? [1, 1, 1];
          const halfX = Math.max(eps, size[0] * 0.5);
          const halfY = Math.max(eps, size[1] * 0.5);
          const halfZ = Math.max(eps, size[2] * 0.5);
          const minX = center[0] - halfX;
          const maxX = center[0] + halfX;
          const minY = center[1] - halfY;
          const maxY = center[1] + halfY;
          const minZ = center[2] - halfZ;
          const maxZ = center[2] + halfZ;
          const px = particle.position.x;
          const py = particle.position.y;
          const pz = particle.position.z;

          if (px > minX + eps && px < maxX - eps && py > minY + eps && py < maxY - eps && pz > minZ + eps && pz < maxZ - eps) {
            const distToMinX = px - minX;
            const distToMaxX = maxX - px;
            const distToMinY = py - minY;
            const distToMaxY = maxY - py;
            const distToMinZ = pz - minZ;
            const distToMaxZ = maxZ - pz;

            let axis: "x" | "y" | "z" = "x";
            let useMinFace = distToMinX < distToMaxX;
            let bestDist = Math.min(distToMinX, distToMaxX);

            const yBest = Math.min(distToMinY, distToMaxY);
            if (yBest < bestDist) {
              bestDist = yBest;
              axis = "y";
              useMinFace = distToMinY < distToMaxY;
            }

            const zBest = Math.min(distToMinZ, distToMaxZ);
            if (zBest < bestDist) {
              axis = "z";
              useMinFace = distToMinZ < distToMaxZ;
            }

            if (axis === "x") {
              particle.position.x = useMinFace ? minX - (particleVisualRadius + eps) : maxX + (particleVisualRadius + eps);
              tempVectorA.set(useMinFace ? -1 : 1, 0, 0);
            } else if (axis === "y") {
              particle.position.y = useMinFace ? minY - (particleVisualRadius + eps) : maxY + (particleVisualRadius + eps);
              tempVectorA.set(0, useMinFace ? -1 : 1, 0);
            } else {
              particle.position.z = useMinFace ? minZ - (particleVisualRadius + eps) : maxZ + (particleVisualRadius + eps);
              tempVectorA.set(0, 0, useMinFace ? -1 : 1);
            }

            this.backendOptions.onParticleCollision?.(particle);
            if (collision.killOnCollision) {
              particle.alive = false;
              this._aliveCount = Math.max(0, this._aliveCount - 1);
              this.backendOptions.onParticleDeath?.(particle);
              continue;
            }

            const bounce = collision.bounce ?? 0.4;
            const dampening = collision.dampening ?? 1;
            const normalVelocity = particle.velocity.dot(tempVectorA);
            if (normalVelocity < 0) {
              particle.velocity.addScaledVector(tempVectorA, -(1 + bounce) * normalVelocity);
            }
            tempVectorB.copy(tempVectorA).multiplyScalar(particle.velocity.dot(tempVectorA));
            tempVectorC.copy(particle.velocity).sub(tempVectorB).multiplyScalar(dampening);
            particle.velocity.copy(tempVectorB).add(tempVectorC);
          }
        }
      }

      let angularVel = particle.angularVelocity;
      const rbs = this.preset.rotationBySpeed;
      if (rbs?.angularVelocity && rbs.speedRange) {
        angularVel = THREE.MathUtils.degToRad(evaluateCurve(rbs.angularVelocity, speedToParam(simSpeed, rbs.speedRange), 0));
      }
      particle.rotation += angularVel * dt;
    }
  }

  private updateGeometry(camera: THREE.Camera): void {
    const rendererType = this.preset.renderer?.type ?? "billboard";
    const stretchFactor = this.preset.renderer?.stretchFactor ?? 0.35;
    const stretchMaxScale = this.preset.renderer?.stretchMaxScale ?? 4;
    const align = this.preset.renderer?.align ?? "camera";
    const cameraRight = tempVectorA.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const cameraUp = tempVectorB.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const cameraForward = tempVectorC.setFromMatrixColumn(camera.matrixWorld, 2).normalize();
    const worldSpace = this.simulationSpace === "world";
    if (worldSpace) {
      this.object.updateWorldMatrix(true, false);
      tempMatrixA.copy(this.object.matrixWorld).invert();
    }

    const aliveCount = this.collectAliveIndices(camera);
    this.sortAliveIndices(aliveCount);

    let vertexOffset = 0;
    let uvOffset = 0;
    let colorOffset = 0;
    let dispersalOffset = 0;

    for (let n = 0; n < aliveCount; n++) {
      const particle = this.particles[this.sortIndices[n]];

      const t = THREE.MathUtils.clamp(particle.age / particle.lifetime, 0, 1);
      const seed01 = particle.randomSeed - Math.floor(particle.randomSeed);
      const over = this.preset.overLifetime ?? {};
      let size = particle.startSize * evaluateCurve(over.size, t, 1);
      const sbs = this.preset.sizeBySpeed;
      if (sbs?.curve && sbs.speedRange) {
        size *= evaluateCurve(sbs.curve, speedToParam(particle.velocity.length(), sbs.speedRange), 1);
      }
      const opacity = particle.startOpacity * evaluateCurve(over.opacity, t, 1);
      const lifeColor = evaluateGradient(over.color, t, tempColorA);
      const finalColor = tempColorB.copy(particle.startColor).multiply(lifeColor);
      const cbs = this.preset.colorBySpeed;
      if (cbs?.gradient && cbs.speedRange) {
        evaluateGradient(cbs.gradient, speedToParam(particle.velocity.length(), cbs.speedRange), tempColorA);
        finalColor.multiply(tempColorA);
      }

      let right = cameraRight;
      let up = cameraUp;

      if (align === "velocity" && particle.velocity.lengthSq() > 0.0001) {
        right = particle.velocity.clone().normalize();
        up = cameraForward.clone().cross(right).normalize();
        if (up.lengthSq() < 0.0001) up = cameraUp;
      }

      if (rendererType === "stretchedBillboard" && particle.velocity.lengthSq() > 0.0001) {
        right = particle.velocity.clone().normalize();
        up = cameraForward.clone().cross(right).normalize();
        if (up.lengthSq() < 0.0001) up = cameraUp;
      }

      const half = size * 0.5;
      const cos = Math.cos(particle.rotation);
      const sin = Math.sin(particle.rotation);
      const stretchScale =
        rendererType === "stretchedBillboard"
          ? THREE.MathUtils.clamp(1 + particle.velocity.length() * stretchFactor, 1, stretchMaxScale)
          : 1;
      const r = right.clone().multiplyScalar(half * stretchScale);
      const u = up.clone().multiplyScalar(half);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]] as const;
      const uv = this.getParticleUvs(particle, t);
      const uvs = [[uv.u0, uv.v1], [uv.u1, uv.v1], [uv.u1, uv.v0], [uv.u0, uv.v1], [uv.u1, uv.v0], [uv.u0, uv.v0]] as const;

      for (let i = 0; i < 6; i++) {
        const x = corners[i][0];
        const y = corners[i][1];
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        const corner = tempVectorD.copy(particle.position).addScaledVector(r, rx).addScaledVector(u, ry);
        if (worldSpace) corner.applyMatrix4(tempMatrixA);

        this.positions[vertexOffset++] = corner.x;
        this.positions[vertexOffset++] = corner.y;
        this.positions[vertexOffset++] = corner.z;
        this.uvs[uvOffset++] = uvs[i][0];
        this.uvs[uvOffset++] = uvs[i][1];
        this.colors[colorOffset++] = finalColor.r;
        this.colors[colorOffset++] = finalColor.g;
        this.colors[colorOffset++] = finalColor.b;
        this.colors[colorOffset++] = opacity;
        this.dispersalAttrs[dispersalOffset++] = t;
        this.dispersalAttrs[dispersalOffset++] = seed01;
      }
    }

    this.geometry.setDrawRange(0, aliveCount * 6);
    this.positionAttribute.needsUpdate = true;
    this.uvAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
    this.dispersalAttribute.needsUpdate = true;
    if (aliveCount > 0) this.geometry.computeBoundingSphere();
  }

  private collectAliveIndices(camera: THREE.Camera): number {
    const mode = this.sortMode;
    let aliveCount = 0;

    if (mode === "distance") {
      this.object.updateWorldMatrix(true, false);
      const matrixWorld = this.object.matrixWorld;
      // Camera forward (third matrix column) and camera world position.
      const forwardX = camera.matrixWorld.elements[8];
      const forwardY = camera.matrixWorld.elements[9];
      const forwardZ = camera.matrixWorld.elements[10];
      const camX = camera.matrixWorld.elements[12];
      const camY = camera.matrixWorld.elements[13];
      const camZ = camera.matrixWorld.elements[14];
      const e = matrixWorld.elements;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (!p.alive) continue;
        const wx =
          this.simulationSpace === "world" ? p.position.x : e[0] * p.position.x + e[4] * p.position.y + e[8] * p.position.z + e[12];
        const wy =
          this.simulationSpace === "world" ? p.position.y : e[1] * p.position.x + e[5] * p.position.y + e[9] * p.position.z + e[13];
        const wz =
          this.simulationSpace === "world" ? p.position.z : e[2] * p.position.x + e[6] * p.position.y + e[10] * p.position.z + e[14];
        // In Three.js the camera looks down -Z, so depth-from-camera = -forward · (worldPos - camPos).
        const dx = wx - camX;
        const dy = wy - camY;
        const dz = wz - camZ;
        const depth = -(forwardX * dx + forwardY * dy + forwardZ * dz);
        this.sortIndices[aliveCount] = i;
        this.sortKeys[aliveCount] = depth;
        aliveCount++;
      }
    } else if (mode === "youngestFirst" || mode === "oldestFirst") {
      const sign = mode === "youngestFirst" ? -1 : 1;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (!p.alive) continue;
        this.sortIndices[aliveCount] = i;
        this.sortKeys[aliveCount] = sign * p.age;
        aliveCount++;
      }
    } else {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (!p.alive) continue;
        this.sortIndices[aliveCount] = i;
        aliveCount++;
      }
    }

    this._aliveCount = aliveCount;
    return aliveCount;
  }

  private sortAliveIndices(aliveCount: number): void {
    if (this.sortMode === "none" || aliveCount < 2) return;
    // Sort indices ascending by their key. For "distance" we want farthest first (largest depth first),
    // so collectAliveIndices stored depth in keys and we sort descending here.
    // For "youngestFirst"/"oldestFirst" we want the named cohort drawn LAST, so we sort
    // ascending by key (-age for youngestFirst, +age for oldestFirst), placing the winning
    // particles at the end of the buffer.
    const keys = this.sortKeys;
    const indices = this.sortIndices;
    if (this.sortMode === "distance") {
      // Insertion sort is fast for typical CPU counts (≤ a few hundred) and avoids closure allocations.
      for (let i = 1; i < aliveCount; i++) {
        const idx = indices[i];
        const key = keys[i];
        let j = i - 1;
        while (j >= 0 && keys[j] < key) {
          indices[j + 1] = indices[j];
          keys[j + 1] = keys[j];
          j--;
        }
        indices[j + 1] = idx;
        keys[j + 1] = key;
      }
    } else {
      for (let i = 1; i < aliveCount; i++) {
        const idx = indices[i];
        const key = keys[i];
        let j = i - 1;
        while (j >= 0 && keys[j] > key) {
          indices[j + 1] = indices[j];
          keys[j + 1] = keys[j];
          j--;
        }
        indices[j + 1] = idx;
        keys[j + 1] = key;
      }
    }
  }

  private getParticleUvs(particle: Particle, t: number): { u0: number; v0: number; u1: number; v1: number } {
    const sheet = getTextureSheetConfig(this.preset);
    if (!sheet) return { u0: 0, v0: 0, u1: 1, v1: 1 };

    let frame = particle.startFrame;
    if (sheet.frameOverLifetime) frame += Math.floor(t * sheet.totalFrames);
    frame = THREE.MathUtils.clamp(frame, 0, sheet.totalFrames - 1);

    const column = frame % sheet.columns;
    const row = Math.floor(frame / sheet.columns);
    const uSize = 1 / sheet.columns;
    const vSize = 1 / sheet.rows;

    return {
      u0: column * uSize,
      u1: (column + 1) * uSize,
      v0: 1 - (row + 1) * vSize,
      v1: 1 - row * vSize,
    };
  }
}
