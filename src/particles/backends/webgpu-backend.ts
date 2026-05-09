import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  If,
  cameraFar,
  cameraNear,
  cos,
  float,
  int,
  instanceIndex,
  instancedArray,
  length,
  max,
  mix,
  mx_fractal_noise_float,
  mx_fractal_noise_vec3,
  perspectiveDepthToViewZ,
  positionGeometry,
  positionView,
  screenUV,
  sin,
  smoothstep,
  spritesheetUV,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import type {
  Particle,
  ParticleBackend,
  ParticleComputeMode,
  ParticleMotionMode,
  ParticlePreset,
  Range,
  SimulationSpace,
  SoftParticleDepthTextureOptions,
  TextureSheetConfig,
  WebGPURendererLike,
} from "../types";
import {
  DEFAULT_EMITTER,
  applyBlendMode,
  evaluateCurve,
  evaluateGradient,
  fbmNoise3,
  getTextureSheetConfig,
  isRendererDispersalEnabled,
  makeCurveFloatTexture,
  makeDispersalAmountCurveTexture,
  randomColor,
  randomRange,
  randomVec3,
  resolveRendererTexture,
  sampleEmitter,
  speedToParam,
  tempColorA,
  tempColorB,
  tempMatrixA,
  tempVectorA,
  tempVectorB,
  tempVectorC,
  tempVectorD,
} from "../shared";

type TslStorageNode = {
  value: THREE.BufferAttribute;
  element: (index: unknown) => any;
  toAttribute: () => any;
};

/**
 * Experimental WebGPU v0 backend.
 *
 * This first slice renders WebGPU-compatible instanced billboards. When the
 * renderer exposes storage-buffer readback, the instance data is derived from
 * the compute-updated storage buffers; otherwise rendering stays on the CPU
 * mirror while compute runs as a sidecar diagnostic.
 */
export class WebGPUParticleBackend implements ParticleBackend {
  readonly object = new THREE.Object3D();
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.Material;
  readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.Material>;

  private particles: Particle[] = [];
  private maxParticles: number;
  private _elapsed = 0;
  private _aliveCount = 0;
  private emissionAccumulator = 0;
  private playing = false;
  private emissionComplete = false;
  private burstCursor = 0;
  private spawnCursor = 0;
  private _disposed = false;
  private sortedBursts: Array<{ time: number; count: Range; probability?: number }>;
  private simulationSpace: SimulationSpace;
  private positionAgeData: Float32Array;
  private velocityLifeData: Float32Array;
  private stateData: Float32Array;
  private renderStateData: Float32Array;
  private renderFrameData: Float32Array;
  private pointAttractorStrengthCurveTexture: THREE.DataTexture;
  private dispersalAmountCurveTexture: THREE.DataTexture | null = null;
  private softParticleDepthPlaceholder: THREE.DataTexture;
  private softParticleDepthNode?: any;
  private positionAgeNode: TslStorageNode;
  private velocityLifeNode: TslStorageNode;
  private stateNode: TslStorageNode;
  private renderStateNode: TslStorageNode;
  private renderFrameNode: TslStorageNode;
  private computeNode: unknown;
  private computeDtUniform = uniform(0);
  private computeAccelerationUniform = uniform(new THREE.Vector3());
  private computeDragUniform = uniform(0);
  private computePointAttractorEnabledUniform = uniform(0);
  private computePointAttractorCenterUniform = uniform(new THREE.Vector3());
  private computePointAttractorStrengthUniform = uniform(0);
  private computePointAttractorEpsilonUniform = uniform(1e-4);
  private computeVortexEnabledUniform = uniform(0);
  private computeVortexCenterUniform = uniform(new THREE.Vector3());
  private computeVortexAxisUniform = uniform(new THREE.Vector3(0, 1, 0));
  private computeVortexOrbitalSpeedUniform = uniform(0);
  private computeVortexInwardUniform = uniform(0);
  private computeVortexUpwardUniform = uniform(0);
  private computeNoiseStrengthUniform = uniform(0);
  private computeNoiseFrequencyUniform = uniform(1);
  private computeNoiseScrollUniform = uniform(new THREE.Vector3(0.2, 0.35, 0.17));
  private computeNoiseTimeUniform = uniform(0);
  private computeNoiseOctavesUniform = uniform(2);
  private computeNoiseLacunarityUniform = uniform(2);
  private computeNoisePersistenceUniform = uniform(0.5);
  private tslCameraRightUniform = uniform(new THREE.Vector3(1, 0, 0));
  private tslCameraUpUniform = uniform(new THREE.Vector3(0, 1, 0));
  private tslCameraForwardUniform = uniform(new THREE.Vector3(0, 0, 1));
  private dispersalStrengthUniform = uniform(1);
  private dispersalNoiseScaleUniform = uniform(6);
  private dispersalEdgeUniform = uniform(0.12);
  private dispersalScrollUniform = uniform(new THREE.Vector2());
  private dispersalTimeUniform = uniform(0);
  private softParticleEnabledUniform = uniform(0);
  private softParticleSoftnessUniform = uniform(1.5);
  private positionAgeNeedsUpload = false;
  private velocityLifeNeedsUpload = false;
  private stateNeedsUpload = false;
  private renderStateNeedsUpload = false;
  private renderFrameNeedsUpload = false;
  private motionReadbackPending = false;
  private motionReadbackGeneration = 0;
  private storageWriteGeneration = 0;
  private computeAvailable: boolean;
  private authoritativeReadbackAvailable: boolean;
  private useTslBillboards: boolean;
  private texture: THREE.Texture | null;
  private textureSheetConfig?: TextureSheetConfig;

  constructor(private preset: ParticlePreset, private renderer: WebGPURendererLike) {
    void this.renderer;
    this.maxParticles = preset.maxParticles ?? 1024;
    this.sortedBursts = [...(preset.emission?.bursts ?? [])].sort((a, b) => a.time - b.time);
    this.simulationSpace = preset.simulationSpace ?? "local";
    this.computeAvailable = typeof renderer.compute === "function";
    this.authoritativeReadbackAvailable = this.computeAvailable && typeof renderer.getArrayBufferAsync === "function";
    this.useTslBillboards = this.authoritativeReadbackAvailable;
    this.textureSheetConfig = getTextureSheetConfig(preset);
    this.positionAgeData = new Float32Array(this.maxParticles * 4);
    this.velocityLifeData = new Float32Array(this.maxParticles * 4);
    this.stateData = new Float32Array(this.maxParticles * 4);
    this.renderStateData = new Float32Array(this.maxParticles * 4);
    this.renderFrameData = new Float32Array(this.maxParticles * 4);
    this.pointAttractorStrengthCurveTexture = makeCurveFloatTexture(preset.forces?.pointAttractor?.strengthOverLifetime, 1);
    this.softParticleDepthPlaceholder = this.makeSoftParticleDepthPlaceholder();
    if (isRendererDispersalEnabled(preset.renderer)) {
      this.dispersalAmountCurveTexture = makeDispersalAmountCurveTexture(preset.renderer?.dispersal?.amount);
    }
    this.positionAgeNode = instancedArray(this.positionAgeData, "vec4") as TslStorageNode;
    this.velocityLifeNode = instancedArray(this.velocityLifeData, "vec4") as TslStorageNode;
    this.stateNode = instancedArray(this.stateData, "vec4") as TslStorageNode;
    this.renderStateNode = instancedArray(this.renderStateData, "vec4") as TslStorageNode;
    this.renderFrameNode = instancedArray(this.renderFrameData, "vec4") as TslStorageNode;
    this.computeNode = this.makeComputeNode();
    this.texture = resolveRendererTexture(this.preset.renderer);

    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = this.makeMaterial();
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.maxParticles);
    this.mesh.count = 0;
    this.initializeInstanceMatrices();
    this.applyExplicitBounds();
    this.object.add(this.mesh);

    for (let i = 0; i < this.maxParticles; i++) this.particles.push(this.createDeadParticle());
    if (preset.prewarm) this.prewarm();
  }

  get elapsed(): number {
    return this._elapsed;
  }

  get aliveCount(): number {
    return this._aliveCount;
  }

  get isAlive(): boolean {
    return this._aliveCount > 0;
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

  get computeMode(): ParticleComputeMode {
    if (!this.computeAvailable) return "unavailable";
    if (this.authoritativeReadbackAvailable) return "authoritative";
    return "sidecar";
  }

  get motionMode(): ParticleMotionMode {
    if (this.authoritativeReadbackAvailable) return "motion-readback-bridge";
    return "cpu-mirror";
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
      this.spawnCursor = 0;
      for (const particle of this.particles) particle.alive = false;
      this._aliveCount = 0;
      this.mesh.count = 0;
      this.positionAgeData.fill(0);
      this.velocityLifeData.fill(0);
      this.stateData.fill(0);
      this.renderStateData.fill(0);
      this.renderFrameData.fill(0);
      this.markAllStorageDirty();
    }
  }

  restart(): void {
    this.stop({ clear: true });
    this.play();
  }

  emit(count: number): void {
    if (count <= 0) return;
    const maxSpawn = this.preset.gpu?.maxSpawnPerFrame ?? this.maxParticles;
    const clamped = Math.min(Math.floor(count), maxSpawn);
    for (let i = 0; i < clamped; i++) this.spawnParticle();
  }

  setSoftParticleDepthTexture(depthTexture: THREE.Texture | null, _options: SoftParticleDepthTextureOptions = {}): void {
    if (this.softParticleDepthNode) {
      this.softParticleDepthNode.value = depthTexture ?? this.softParticleDepthPlaceholder;
    }
    this.softParticleEnabledUniform.value = this.preset.renderer?.softParticles && depthTexture ? 1 : 0;
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this._disposed) return;

    const duration = this.preset.duration ?? 1;
    const loop = this.preset.loop ?? false;

    if (this.playing) {
      this._elapsed += dt;

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

    if (this.authoritativeReadbackAvailable) this.updateAuthoritativeLifecycle(dt);
    if (this.computeAvailable) this.runCompute(dt);
    if (!this.authoritativeReadbackAvailable) this.updateParticles(dt);
    this.updateInstances(camera);
  }

  dispose({ disposeTexture = false } = {}): void {
    if (this._disposed) return;
    this.object.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.pointAttractorStrengthCurveTexture.dispose();
    this.dispersalAmountCurveTexture?.dispose();
    this.softParticleDepthPlaceholder.dispose();
    if (disposeTexture && this.texture) this.texture.dispose();
    const dispersalMap = this.preset.renderer?.dispersal?.texture;
    if (disposeTexture && dispersalMap && dispersalMap !== this.texture) dispersalMap.dispose();
    this._disposed = true;
  }

  private makeMaterial(): THREE.Material {
    if (this.useTslBillboards) return this.makeTslBillboardMaterial();

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: this.preset.renderer?.depthWrite ?? false,
      depthTest: this.preset.renderer?.depthTest ?? true,
      vertexColors: true,
    });
    applyBlendMode(material, this.preset.renderer?.blendMode);
    return material;
  }

  private makeTslBillboardMaterial(): THREE.Material {
    const material = new MeshBasicNodeMaterial({
      map: this.textureSheetConfig ? null : this.texture,
      transparent: true,
      depthWrite: this.preset.renderer?.depthWrite ?? false,
      depthTest: this.preset.renderer?.depthTest ?? true,
      vertexColors: true,
    });
    const positionAttribute = this.positionAgeNode.toAttribute().setInstanced(true);
    const velocityAttribute = this.velocityLifeNode.toAttribute().setInstanced(true);
    const stateAttribute = this.renderStateNode.toAttribute().setInstanced(true);
    const frameAttribute = this.renderFrameNode.toAttribute().setInstanced(true);
    const activeSize = stateAttribute.x.mul(stateAttribute.y);
    const rotationCos = cos(stateAttribute.z);
    const rotationSin = sin(stateAttribute.z);
    const rendererType = this.preset.renderer?.type;
    const useVelocityBasis = this.preset.renderer?.align === "velocity" || rendererType === "stretchedBillboard";
    let rightBasis = this.tslCameraRightUniform as any;
    let upBasis = this.tslCameraUpUniform as any;
    let stretchScale = float(1) as any;

    if (useVelocityBasis) {
      const velocity = velocityAttribute.xyz;
      const speed = length(velocity);
      const safeSpeed = max(speed, float(0.0001));
      const velocityRight = velocity.div(safeSpeed);
      const rawVelocityUp = this.tslCameraForwardUniform.cross(velocityRight);
      const rawVelocityUpLength = length(rawVelocityUp);
      const velocityUp = rawVelocityUp.div(max(rawVelocityUpLength, float(0.0001)));
      const velocityWeight = smoothstep(float(0.0001), float(0.02), speed);
      const upWeight = velocityWeight.mul(smoothstep(float(0.0001), float(0.02), rawVelocityUpLength));
      rightBasis = mix(this.tslCameraRightUniform, velocityRight, velocityWeight).normalize();
      upBasis = mix(this.tslCameraUpUniform, velocityUp, upWeight).normalize();
      if (rendererType === "stretchedBillboard") {
        const stretchFactor = this.preset.renderer?.stretchFactor ?? 0.35;
        const stretchMaxScale = Math.max(1, this.preset.renderer?.stretchMaxScale ?? 4);
        stretchScale = speed.mul(stretchFactor).add(1).clamp(1, stretchMaxScale);
      }
    }

    const localPosition = positionGeometry as any;
    const rotatedX = localPosition.x.mul(rotationCos).sub(localPosition.y.mul(rotationSin)).mul(activeSize).mul(stretchScale);
    const rotatedY = localPosition.x.mul(rotationSin).add(localPosition.y.mul(rotationCos)).mul(activeSize);
    const billboardOffset = rightBasis.mul(rotatedX).add(upBasis.mul(rotatedY));
    const baseUv = uv();
    const sampleUv =
      this.textureSheetConfig
        ? spritesheetUV(vec2(this.textureSheetConfig.columns, this.textureSheetConfig.rows), baseUv, frameAttribute.x)
        : baseUv;

    material.positionNode = positionAttribute.xyz.add(billboardOffset);
    let opacityNode = stateAttribute.w.mul(stateAttribute.x);
    if (this.dispersalAmountCurveTexture) {
      const dispersalMap = this.preset.renderer?.dispersal?.texture;
      const seed = frameAttribute.z;
      const scroll = this.dispersalScrollUniform.mul(this.dispersalTimeUniform);
      const noiseUv = (sampleUv as any).mul(this.dispersalNoiseScaleUniform).add(vec2(seed.mul(17.413), seed.mul(63.291))).add(scroll);
      const mapUv = (sampleUv as any).sub(vec2(0.5)).mul(this.dispersalNoiseScaleUniform).add(vec2(0.5)).add(scroll);
      const n = dispersalMap
        ? texture(dispersalMap, mapUv).r
        : mx_fractal_noise_float(vec3(noiseUv.x, noiseUv.y, seed), int(2), 2, 0.5).mul(0.5).add(0.5).clamp(0, 1);
      const amount = texture(this.dispersalAmountCurveTexture, vec2(frameAttribute.y.clamp(0, 1), 0.5)).r;
      const edge = max(this.dispersalEdgeUniform, float(0.0001));
      const lo = amount.mul(float(1).add(edge.mul(2))).sub(edge);
      const hi = lo.add(edge);
      const mask = smoothstep(lo, hi, n);
      const strength = this.dispersalStrengthUniform.clamp(0, 1);
      opacityNode = opacityNode.mul(float(1).sub(strength).add(mask.mul(strength)));
    }
    if (this.preset.renderer?.softParticles) {
      this.softParticleDepthNode = texture(this.softParticleDepthPlaceholder, screenUV);
      const sceneViewZ = perspectiveDepthToViewZ(this.softParticleDepthNode.r, cameraNear, cameraFar);
      const fade = positionView.z.sub(sceneViewZ).mul(this.softParticleSoftnessUniform).clamp(0, 1);
      const softFactor = float(1).sub(this.softParticleEnabledUniform).add(fade.mul(this.softParticleEnabledUniform));
      opacityNode = opacityNode.mul(softFactor);
    }
    material.opacityNode = opacityNode;
    if (this.texture && this.textureSheetConfig) {
      material.colorNode = texture(this.texture, sampleUv);
    }
    applyBlendMode(material, this.preset.renderer?.blendMode);
    return material;
  }

  private initializeInstanceMatrices(): void {
    for (let i = 0; i < this.maxParticles; i++) this.mesh.setMatrixAt(i, tempMatrixA.identity());
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private applyExplicitBounds(): void {
    const bounds = this.preset.bounds;
    if (!bounds) {
      this.mesh.frustumCulled = false;
      return;
    }
    const center = bounds.center ?? [0, 0, 0];
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(center[0], center[1], center[2]), bounds.radius);
    this.mesh.frustumCulled = false;
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

  private makeSoftParticleDepthPlaceholder(): THREE.DataTexture {
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.needsUpdate = true;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
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
    const slot = this.spawnCursor;
    this.spawnCursor = (this.spawnCursor + 1) % this.maxParticles;
    const particle = this.particles[slot];
    if (!particle) return;

    const sample = sampleEmitter(this.preset.emitter ?? DEFAULT_EMITTER);
    const start = this.preset.start ?? {};

    const wasAlive = particle.alive;
    particle.alive = true;
    if (!wasAlive) this._aliveCount++;
    particle.position.copy(sample.position);
    particle.age = 0;
    particle.lifetime = Math.max(0.01, randomRange(start.lifetime ?? 1));
    particle.velocity.copy(sample.direction).multiplyScalar(randomRange(start.speed ?? 1)).add(randomVec3(start.velocity ?? [0, 0, 0]));
    particle.startSize = randomRange(start.size ?? 0.2);
    particle.startOpacity = randomRange(start.opacity ?? 1);
    particle.startColor.copy(randomColor(start.color ?? "#ffffff"));
    particle.rotation = randomRange(start.rotation ?? 0);
    particle.angularVelocity = randomRange(start.angularVelocity ?? 0);
    particle.randomSeed = Math.random() * 1000;
    particle.startFrame = this.textureSheetConfig?.randomFrame ? Math.floor(Math.random() * this.textureSheetConfig.totalFrames) : 0;

    if (this.simulationSpace === "world") {
      this.object.updateWorldMatrix(true, false);
      particle.position.applyMatrix4(this.object.matrixWorld);
      tempMatrixA.copy(this.object.matrixWorld).setPosition(0, 0, 0);
      particle.velocity.applyMatrix4(tempMatrixA);
    }

    this.writeParticleToStorage(slot, particle);
  }

  private makeComputeNode(): unknown {
    const positionAge = this.positionAgeNode;
    const velocityLife = this.velocityLifeNode;
    const state = this.stateNode;
    const dt = this.computeDtUniform;
    const acceleration = this.computeAccelerationUniform;
    const drag = this.computeDragUniform;
    const pointAttractorEnabled = this.computePointAttractorEnabledUniform;
    const pointAttractorCenter = this.computePointAttractorCenterUniform;
    const pointAttractorStrength = this.computePointAttractorStrengthUniform;
    const pointAttractorEpsilon = this.computePointAttractorEpsilonUniform;
    const pointAttractorStrengthCurve = this.pointAttractorStrengthCurveTexture;
    const vortexEnabled = this.computeVortexEnabledUniform;
    const vortexCenter = this.computeVortexCenterUniform;
    const vortexAxis = this.computeVortexAxisUniform;
    const vortexOrbitalSpeed = this.computeVortexOrbitalSpeedUniform;
    const vortexInward = this.computeVortexInwardUniform;
    const vortexUpward = this.computeVortexUpwardUniform;
    const noiseStrength = this.computeNoiseStrengthUniform;
    const noiseFrequency = this.computeNoiseFrequencyUniform;
    const noiseScroll = this.computeNoiseScrollUniform;
    const noiseTime = this.computeNoiseTimeUniform;
    const noiseOctaves = this.computeNoiseOctavesUniform;
    const noiseLacunarity = this.computeNoiseLacunarityUniform;
    const noisePersistence = this.computeNoisePersistenceUniform;

    return Fn(() => {
      const index = instanceIndex;
      const pa = positionAge.element(index).toVar();
      const vl = velocityLife.element(index).toVar();
      const st = state.element(index).toVar();

      If(st.x.greaterThan(0.5), () => {
        pa.w.addAssign(dt);
        If(pa.w.greaterThanEqual(vl.w), () => {
          st.x.assign(0);
        }).Else(() => {
          vl.x.addAssign(acceleration.x.mul(dt));
          vl.y.addAssign(acceleration.y.mul(dt));
          vl.z.addAssign(acceleration.z.mul(dt));

          If(pointAttractorEnabled.greaterThan(0.5), () => {
            const toCenter = pointAttractorCenter.sub(pa.xyz).toVar();
            const dist = toCenter.length().toVar();
            If(dist.greaterThan(pointAttractorEpsilon), () => {
              const ageT = pa.w.div(max(float(0.0001), vl.w)).clamp(0, 1).toVar();
              const strengthMultiplier = texture(pointAttractorStrengthCurve, vec2(ageT, 0.5)).r.toVar();
              const attraction = pointAttractorStrength.mul(strengthMultiplier).mul(dt).div(dist).toVar();
              vl.x.addAssign(toCenter.x.mul(attraction));
              vl.y.addAssign(toCenter.y.mul(attraction));
              vl.z.addAssign(toCenter.z.mul(attraction));
            });
          });

          If(vortexEnabled.greaterThan(0.5), () => {
            const radial = pa.xyz.sub(vortexCenter).toVar();
            const axialDist = radial.dot(vortexAxis).toVar();
            const radialPlane = radial.sub(vortexAxis.mul(axialDist)).toVar();
            const radialLen = radialPlane.length().toVar();
            If(radialLen.greaterThan(0.00001), () => {
              const radialDir = radialPlane.div(radialLen).toVar();
              const tangent = vortexAxis.cross(radialDir).toVar();
              const tangentLen = tangent.length().toVar();
              If(tangentLen.greaterThan(0.00001), () => {
                const tangentForce = vortexOrbitalSpeed.mul(dt).div(tangentLen).toVar();
                vl.x.addAssign(tangent.x.mul(tangentForce));
                vl.y.addAssign(tangent.y.mul(tangentForce));
                vl.z.addAssign(tangent.z.mul(tangentForce));
              });
              vl.x.subAssign(radialDir.x.mul(vortexInward).mul(dt));
              vl.y.subAssign(radialDir.y.mul(vortexInward).mul(dt));
              vl.z.subAssign(radialDir.z.mul(vortexInward).mul(dt));
            });
            vl.x.addAssign(vortexAxis.x.mul(vortexUpward).mul(dt));
            vl.y.addAssign(vortexAxis.y.mul(vortexUpward).mul(dt));
            vl.z.addAssign(vortexAxis.z.mul(vortexUpward).mul(dt));
          });

          If(noiseStrength.greaterThan(0), () => {
            const noiseOffset = vec3(float(index).mul(0.01)).toVar();
            const noiseP = pa.xyz.mul(noiseFrequency).add(noiseScroll.mul(noiseTime)).add(noiseOffset).toVar();
            const noise = mx_fractal_noise_vec3(noiseP, int(noiseOctaves), noiseLacunarity, noisePersistence).toVar();
            const noiseScale = noiseStrength.mul(dt).toVar();
            vl.x.addAssign(noise.x.mul(noiseScale));
            vl.y.addAssign(noise.y.mul(noiseScale));
            vl.z.addAssign(noise.z.mul(noiseScale));
          });

          const dragFactor = max(float(0), float(1).sub(drag.mul(dt))).toVar();
          vl.x.assign(vl.x.mul(dragFactor));
          vl.y.assign(vl.y.mul(dragFactor));
          vl.z.assign(vl.z.mul(dragFactor));

          pa.x.addAssign(vl.x.mul(dt));
          pa.y.addAssign(vl.y.mul(dt));
          pa.z.addAssign(vl.z.mul(dt));
          st.z.addAssign(st.w.mul(dt));
        });
      });

      positionAge.element(index).assign(pa);
      velocityLife.element(index).assign(vl);
      state.element(index).assign(st);
    })().compute(this.maxParticles, [64]).setName("Wisp WebGPU Particle Integrate");
  }

  private writeParticleToStorage(slot: number, particle: Particle): void {
    const offset = slot * 4;
    this.positionAgeData[offset + 0] = particle.position.x;
    this.positionAgeData[offset + 1] = particle.position.y;
    this.positionAgeData[offset + 2] = particle.position.z;
    this.positionAgeData[offset + 3] = particle.age;
    this.velocityLifeData[offset + 0] = particle.velocity.x;
    this.velocityLifeData[offset + 1] = particle.velocity.y;
    this.velocityLifeData[offset + 2] = particle.velocity.z;
    this.velocityLifeData[offset + 3] = particle.lifetime;
    this.stateData[offset + 0] = particle.alive ? 1 : 0;
    this.stateData[offset + 1] = particle.startSize;
    this.stateData[offset + 2] = particle.rotation;
    this.stateData[offset + 3] = particle.angularVelocity;
    this.renderStateData[offset + 0] = particle.alive ? 1 : 0;
    this.renderStateData[offset + 1] = particle.startSize;
    this.renderStateData[offset + 2] = particle.rotation;
    this.renderStateData[offset + 3] = particle.startOpacity;
    this.renderFrameData[offset + 0] = this.getTextureSheetFrame(particle, 0);
    this.renderFrameData[offset + 1] = THREE.MathUtils.clamp(particle.age / particle.lifetime, 0, 1);
    this.renderFrameData[offset + 2] = (particle.randomSeed * 0.1031) % 1;
    this.renderFrameData[offset + 3] = 0;
    this.markAllStorageDirty();
  }

  private markAllStorageDirty(): void {
    this.storageWriteGeneration++;
    this.positionAgeNeedsUpload = true;
    this.velocityLifeNeedsUpload = true;
    this.stateNeedsUpload = true;
    this.renderStateNeedsUpload = true;
    this.renderFrameNeedsUpload = true;
  }

  private uploadDirtyStorage(): void {
    if (this.positionAgeNeedsUpload) {
      this.positionAgeNode.value.needsUpdate = true;
      this.positionAgeNeedsUpload = false;
    }
    if (this.velocityLifeNeedsUpload) {
      this.velocityLifeNode.value.needsUpdate = true;
      this.velocityLifeNeedsUpload = false;
    }
    if (this.stateNeedsUpload) {
      this.stateNode.value.needsUpdate = true;
      this.stateNeedsUpload = false;
    }
    if (this.renderStateNeedsUpload) {
      this.renderStateNode.value.needsUpdate = true;
      this.renderStateNeedsUpload = false;
    }
    if (this.renderFrameNeedsUpload) {
      this.renderFrameNode.value.needsUpdate = true;
      this.renderFrameNeedsUpload = false;
    }
  }

  private runCompute(dt: number): void {
    if (!this.renderer.compute) return;
    this.uploadDirtyStorage();
    const acceleration = this.preset.forces?.acceleration ?? [0, 0, 0];
    this.computeDtUniform.value = dt;
    this.computeAccelerationUniform.value.set(acceleration[0], acceleration[1], acceleration[2]);
    this.computeDragUniform.value = this.preset.forces?.drag ?? 0;
    const pointAttractor = this.preset.forces?.pointAttractor;
    this.computePointAttractorEnabledUniform.value = pointAttractor ? 1 : 0;
    this.computePointAttractorCenterUniform.value.set(...(pointAttractor?.center ?? [0, 0, 0]));
    this.computePointAttractorStrengthUniform.value = pointAttractor?.strength ?? 0;
    this.computePointAttractorEpsilonUniform.value = pointAttractor?.epsilon ?? 1e-4;
    const vortex = this.preset.forces?.vortex;
    this.computeVortexEnabledUniform.value = vortex ? 1 : 0;
    this.computeVortexCenterUniform.value.set(...(vortex?.center ?? [0, 0, 0]));
    const vortexAxis = tempVectorA.set(...(vortex?.axis ?? [0, 1, 0]));
    if (vortexAxis.lengthSq() < 1e-8) vortexAxis.set(0, 1, 0);
    else vortexAxis.normalize();
    this.computeVortexAxisUniform.value.copy(vortexAxis);
    this.computeVortexOrbitalSpeedUniform.value = vortex?.orbitalSpeed ?? 0;
    this.computeVortexInwardUniform.value = vortex?.inward ?? 0;
    this.computeVortexUpwardUniform.value = vortex?.upward ?? 0;
    const noise = this.preset.forces?.noise;
    this.computeNoiseStrengthUniform.value = noise?.strength ?? 0;
    this.computeNoiseFrequencyUniform.value = noise?.frequency ?? 1;
    this.computeNoiseScrollUniform.value.set(...(noise?.scroll ?? [0.2, 0.35, 0.17]));
    this.computeNoiseTimeUniform.value = this._elapsed;
    this.computeNoiseOctavesUniform.value = THREE.MathUtils.clamp(Math.floor(noise?.octaves ?? 2), 1, 4);
    this.computeNoiseLacunarityUniform.value = Math.max(1, noise?.lacunarity ?? 2);
    this.computeNoisePersistenceUniform.value = THREE.MathUtils.clamp(noise?.persistence ?? 0.5, 0.05, 1);
    const computeResult = this.renderer.compute(this.computeNode, this.maxParticles);
    if (this.authoritativeReadbackAvailable) {
      void Promise.resolve(computeResult).then(() => this.requestMotionReadback());
    }
  }

  private requestMotionReadback(): void {
    if (!this.renderer.getArrayBufferAsync || this.motionReadbackPending || this._disposed) return;

    this.motionReadbackPending = true;
    const generation = ++this.motionReadbackGeneration;
    const storageGeneration = this.storageWriteGeneration;
    const positionAttribute = this.positionAgeNode.value;
    const velocityAttribute = this.velocityLifeNode.value;

    void Promise.all([
      this.renderer.getArrayBufferAsync(positionAttribute),
      this.renderer.getArrayBufferAsync(velocityAttribute),
    ])
      .then(([positionBuffer, velocityBuffer]) => {
        if (this._disposed || generation !== this.motionReadbackGeneration || storageGeneration !== this.storageWriteGeneration) return;
        this.positionAgeData.set(new Float32Array(positionBuffer));
        this.velocityLifeData.set(new Float32Array(velocityBuffer));
        positionAttribute.needsUpdate = true;
        velocityAttribute.needsUpdate = true;
      })
      .catch((error) => {
        console.warn("[ParticleSystem] WebGPU motion readback failed; continuing with last available particle positions.", error);
      })
      .finally(() => {
        if (generation === this.motionReadbackGeneration) this.motionReadbackPending = false;
      });
  }

  private updateParticles(dt: number): void {
    const forces = this.preset.forces ?? {};
    const acceleration = tempVectorA.set(...(forces.acceleration ?? [0, 0, 0]));
    const drag = forces.drag ?? 0;
    const lifetimeVelocity = this.preset.velocityOverLifetime;
    const pointAttractor = forces.pointAttractor;
    const pointAttractorCenter = pointAttractor?.center ?? [0, 0, 0];
    const pointAttractorEpsilon = pointAttractor?.epsilon ?? 1e-4;
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

    for (const particle of this.particles) {
      if (!particle.alive) continue;

      particle.age += dt;
      if (particle.age >= particle.lifetime) {
        particle.alive = false;
        this._aliveCount = Math.max(0, this._aliveCount - 1);
        continue;
      }

      particle.velocity.addScaledVector(acceleration, dt);
      if (pointAttractor) {
        const t = THREE.MathUtils.clamp(particle.age / particle.lifetime, 0, 1);
        const strength = (pointAttractor.strength ?? 0) * evaluateCurve(pointAttractor.strengthOverLifetime, t, 1);
        if (strength !== 0) {
          tempVectorA.set(
            pointAttractorCenter[0] - particle.position.x,
            pointAttractorCenter[1] - particle.position.y,
            pointAttractorCenter[2] - particle.position.z
          );
          const distance = tempVectorA.length();
          if (distance > pointAttractorEpsilon) particle.velocity.addScaledVector(tempVectorA, (strength * dt) / distance);
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
          const radialDir = radialPlane.multiplyScalar(1 / radialLen);
          const tangent = tempVectorC.copy(vortexAxis).cross(radialDir);
          const tangentLen = tangent.length();
          if (tangentLen > 1e-5 && vortexOrbital !== 0) particle.velocity.addScaledVector(tangent, (vortexOrbital * dt) / tangentLen);
          if (vortexInward !== 0) particle.velocity.addScaledVector(radialDir, -vortexInward * dt);
        }
        if (vortexUpward !== 0) particle.velocity.addScaledVector(vortexAxis, vortexUpward * dt);
      }
      if (noiseStrength > 0) {
        const tNoise = this._elapsed;
        const seed = particle.randomSeed;
        const px = particle.position.x * noiseFrequency + tNoise * noiseScroll[0] + seed * 0.01;
        const py = particle.position.y * noiseFrequency + tNoise * noiseScroll[1] + seed * 0.013;
        const pz = particle.position.z * noiseFrequency + tNoise * noiseScroll[2] + seed * 0.017;
        const nx = fbmNoise3(px + 17.1, py + 3.2, pz + 5.9, noiseOctaves, noiseLacunarity, noisePersistence) * 2 - 1;
        const ny = fbmNoise3(px - 11.4, py + 19.7, pz + 7.3, noiseOctaves, noiseLacunarity, noisePersistence) * 2 - 1;
        const nz = fbmNoise3(px + 4.8, py - 13.6, pz + 23.1, noiseOctaves, noiseLacunarity, noisePersistence) * 2 - 1;
        particle.velocity.x += nx * noiseStrength * dt;
        particle.velocity.y += ny * noiseStrength * dt;
        particle.velocity.z += nz * noiseStrength * dt;
      }
      if (drag > 0) particle.velocity.multiplyScalar(Math.max(0, 1 - drag * dt));

      const t = THREE.MathUtils.clamp(particle.age / particle.lifetime, 0, 1);
      const linearVelocity = tempVectorB.set(
        evaluateCurve(lifetimeVelocity?.linear?.x, t, 0),
        evaluateCurve(lifetimeVelocity?.linear?.y, t, 0),
        evaluateCurve(lifetimeVelocity?.linear?.z, t, 0)
      );
      particle.position.addScaledVector(tempVectorC.copy(particle.velocity).add(linearVelocity), dt);
      particle.rotation += this.getParticleAngularVelocity(-1, particle) * dt;
    }
  }

  private updateAuthoritativeLifecycle(dt: number): void {
    if (dt <= 0) return;

    for (let slot = 0; slot < this.maxParticles; slot++) {
      const particle = this.particles[slot];
      if (!particle?.alive) continue;

      particle.age += dt;
      particle.rotation += this.getParticleAngularVelocity(slot, particle) * dt;

      if (particle.age < particle.lifetime) continue;

      particle.alive = false;
      this._aliveCount = Math.max(0, this._aliveCount - 1);
      const offset = slot * 4;
      this.stateData[offset + 0] = 0;
      this.renderStateData[offset + 0] = 0;
      this.renderStateData[offset + 1] = 0;
      this.renderStateData[offset + 2] = 0;
      this.renderStateData[offset + 3] = 0;
      this.renderFrameData[offset + 0] = 0;
      this.renderFrameData[offset + 1] = 0;
      this.renderFrameData[offset + 2] = 0;
      this.renderFrameData[offset + 3] = 0;
      this.stateNeedsUpload = true;
      this.renderStateNeedsUpload = true;
      this.renderFrameNeedsUpload = true;
    }
  }

  private updateInstances(camera: THREE.Camera): void {
    if (this.useTslBillboards) {
      this.updateTslCameraBasis(camera);
      this.updateTslInstanceColors();
      return;
    }

    this.object.updateWorldMatrix(true, false);
    const worldToLocal = tempMatrixA.copy(this.object.matrixWorld).invert().clone();
    const basisToLocal = worldToLocal.clone().setPosition(0, 0, 0);
    const cameraRight = tempVectorA.setFromMatrixColumn(camera.matrixWorld, 0).normalize().applyMatrix4(basisToLocal).normalize().clone();
    const cameraUp = tempVectorB.setFromMatrixColumn(camera.matrixWorld, 1).normalize().applyMatrix4(basisToLocal).normalize().clone();
    const cameraForward = tempVectorC.setFromMatrixColumn(camera.matrixWorld, 2).normalize().applyMatrix4(basisToLocal).normalize().clone();
    const worldSpace = this.simulationSpace === "world";
    const over = this.preset.overLifetime ?? {};
    const rendererType = this.preset.renderer?.type;
    const velocityAligned = this.preset.renderer?.align === "velocity" || rendererType === "stretchedBillboard";
    const stretchFactor = this.preset.renderer?.stretchFactor ?? 0.35;
    const stretchMaxScale = Math.max(1, this.preset.renderer?.stretchMaxScale ?? 4);

    let instance = 0;
    for (let slot = 0; slot < this.maxParticles; slot++) {
      const particle = this.particles[slot];
      if (!particle) continue;
      if (!particle.alive) continue;

      const offset = slot * 4;
      const sourceAge = this.authoritativeReadbackAvailable ? this.positionAgeData[offset + 3] : particle.age;
      const sourceLifetime = this.authoritativeReadbackAvailable ? this.velocityLifeData[offset + 3] : particle.lifetime;
      const sourceSize = this.authoritativeReadbackAvailable ? this.stateData[offset + 1] : particle.startSize;
      const sourceRotation = this.authoritativeReadbackAvailable ? this.stateData[offset + 2] : particle.rotation;
      const t = THREE.MathUtils.clamp(sourceAge / sourceLifetime, 0, 1);
      let size = sourceSize * evaluateCurve(over.size, t, 1);
      const sbs = this.preset.sizeBySpeed;
      if (sbs?.curve && sbs.speedRange) {
        const speed = this.getParticleSpeed(slot, particle);
        size *= evaluateCurve(sbs.curve, speedToParam(speed, sbs.speedRange), 1);
      }
      size = Math.max(0, size);
      const opacity = THREE.MathUtils.clamp(particle.startOpacity * evaluateCurve(over.opacity, t, 1), 0, 1);
      const lifeColor = evaluateGradient(over.color, t, tempColorA);
      const finalColor = tempColorB.copy(particle.startColor).multiply(lifeColor).multiplyScalar(opacity);
      const cbs = this.preset.colorBySpeed;
      if (cbs?.gradient && cbs.speedRange) {
        const speed = this.getParticleSpeed(slot, particle);
        evaluateGradient(cbs.gradient, speedToParam(speed, cbs.speedRange), tempColorA);
        finalColor.multiply(tempColorA);
      }

      const position = this.authoritativeReadbackAvailable
        ? tempVectorD.set(this.positionAgeData[offset + 0], this.positionAgeData[offset + 1], this.positionAgeData[offset + 2])
        : tempVectorD.copy(particle.position);
      if (worldSpace) position.applyMatrix4(worldToLocal);

      this.getParticleVelocity(slot, particle, tempVectorA);
      const velocityLength = tempVectorA.length();
      let rightBasis = cameraRight;
      let upBasis = cameraUp;
      if (velocityAligned && velocityLength > 0.0001) {
        rightBasis = tempVectorA.clone().multiplyScalar(1 / velocityLength);
        upBasis = cameraForward.clone().cross(rightBasis).normalize();
        if (upBasis.lengthSq() < 0.0001) upBasis = cameraUp;
      }
      const stretchScale =
        rendererType === "stretchedBillboard" ? THREE.MathUtils.clamp(1 + velocityLength * stretchFactor, 1, stretchMaxScale) : 1;
      const cos = Math.cos(sourceRotation);
      const sin = Math.sin(sourceRotation);
      const right = rightBasis.clone().multiplyScalar(size * stretchScale);
      const up = upBasis.clone().multiplyScalar(size);
      const rotatedRight = right.clone().multiplyScalar(cos).addScaledVector(up, sin);
      const rotatedUp = up.multiplyScalar(cos).addScaledVector(right, -sin);
      const forward = cameraForward.clone();

      tempMatrixA.makeBasis(rotatedRight, rotatedUp, forward);
      tempMatrixA.setPosition(position);
      this.mesh.setMatrixAt(instance, tempMatrixA);
      this.mesh.setColorAt(instance, finalColor);
      instance++;
    }

    this.mesh.count = instance;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (!this.preset.bounds && instance > 0) this.mesh.computeBoundingSphere();
  }

  private updateTslCameraBasis(camera: THREE.Camera): void {
    this.object.updateWorldMatrix(true, false);
    const basisToLocal = tempMatrixA.copy(this.object.matrixWorld).invert();
    basisToLocal.setPosition(0, 0, 0);
    const cameraRight = tempVectorA.setFromMatrixColumn(camera.matrixWorld, 0).normalize().applyMatrix4(basisToLocal).normalize();
    const cameraUp = tempVectorB.setFromMatrixColumn(camera.matrixWorld, 1).normalize().applyMatrix4(basisToLocal).normalize();
    const cameraForward = tempVectorC.setFromMatrixColumn(camera.matrixWorld, 2).normalize().applyMatrix4(basisToLocal).normalize();
    this.tslCameraRightUniform.value.copy(cameraRight);
    this.tslCameraUpUniform.value.copy(cameraUp);
    this.tslCameraForwardUniform.value.copy(cameraForward);
  }

  private updateTslInstanceColors(): void {
    const over = this.preset.overLifetime ?? {};
    const dispersal = this.preset.renderer?.dispersal;
    if (this.dispersalAmountCurveTexture) {
      this.dispersalStrengthUniform.value = dispersal?.strength ?? 1;
      this.dispersalNoiseScaleUniform.value = dispersal?.noiseScale ?? 6;
      this.dispersalEdgeUniform.value = dispersal?.edgeSoftness ?? 0.12;
      this.dispersalScrollUniform.value.set(dispersal?.scroll?.[0] ?? 0, dispersal?.scroll?.[1] ?? 0);
      this.dispersalTimeUniform.value = this._elapsed;
    }
    this.softParticleSoftnessUniform.value = this.preset.renderer?.softness ?? 1.5;
    this.mesh.count = this.maxParticles;
    let renderStateChanged = false;
    let renderFrameChanged = false;

    for (let slot = 0; slot < this.maxParticles; slot++) {
      const particle = this.particles[slot];
      const offset = slot * 4;
      const alive = particle?.alive;

      if (!alive || !particle) {
        this.mesh.setColorAt(slot, tempColorA.setRGB(0, 0, 0));
        if (this.renderStateData[offset + 0] !== 0 || this.renderStateData[offset + 1] !== 0) {
          this.renderStateData[offset + 0] = 0;
          this.renderStateData[offset + 1] = 0;
          this.renderStateData[offset + 2] = 0;
          this.renderStateData[offset + 3] = 0;
          renderStateChanged = true;
        }
        if (
          this.renderFrameData[offset + 0] !== 0 ||
          this.renderFrameData[offset + 1] !== 0 ||
          this.renderFrameData[offset + 2] !== 0 ||
          this.renderFrameData[offset + 3] !== 0
        ) {
          this.renderFrameData[offset + 0] = 0;
          this.renderFrameData[offset + 1] = 0;
          this.renderFrameData[offset + 2] = 0;
          this.renderFrameData[offset + 3] = 0;
          renderFrameChanged = true;
        }
        continue;
      }

      const age = particle.age;
      const lifetime = particle.lifetime;
      const t = THREE.MathUtils.clamp(age / lifetime, 0, 1);
      let renderSize = particle.startSize * evaluateCurve(over.size, t, 1);
      const sbs = this.preset.sizeBySpeed;
      if (sbs?.curve && sbs.speedRange) {
        const speed = this.getParticleSpeed(slot, particle);
        renderSize *= evaluateCurve(sbs.curve, speedToParam(speed, sbs.speedRange), 1);
      }
      renderSize = Math.max(0, renderSize);
      const opacity = THREE.MathUtils.clamp(particle.startOpacity * evaluateCurve(over.opacity, t, 1), 0, 1);
      const lifeColor = evaluateGradient(over.color, t, tempColorA);
      const finalColor = tempColorB.copy(particle.startColor).multiply(lifeColor);
      const cbs = this.preset.colorBySpeed;
      if (cbs?.gradient && cbs.speedRange) {
        const speed = this.getParticleSpeed(slot, particle);
        evaluateGradient(cbs.gradient, speedToParam(speed, cbs.speedRange), tempColorA);
        finalColor.multiply(tempColorA);
      }
      const renderRotation = particle.rotation;
      const renderFrame = this.getTextureSheetFrame(particle, t);
      const renderSeed = (particle.randomSeed * 0.1031) % 1;
      if (
        this.renderStateData[offset + 0] !== 1 ||
        this.renderStateData[offset + 1] !== renderSize ||
        this.renderStateData[offset + 2] !== renderRotation ||
        this.renderStateData[offset + 3] !== opacity
      ) {
        this.renderStateData[offset + 0] = 1;
        this.renderStateData[offset + 1] = renderSize;
        this.renderStateData[offset + 2] = renderRotation;
        this.renderStateData[offset + 3] = opacity;
        renderStateChanged = true;
      }
      if (
        this.renderFrameData[offset + 0] !== renderFrame ||
        this.renderFrameData[offset + 1] !== t ||
        this.renderFrameData[offset + 2] !== renderSeed
      ) {
        this.renderFrameData[offset + 0] = renderFrame;
        this.renderFrameData[offset + 1] = t;
        this.renderFrameData[offset + 2] = renderSeed;
        this.renderFrameData[offset + 3] = 0;
        renderFrameChanged = true;
      }
      this.mesh.setColorAt(slot, finalColor);
    }

    if (renderStateChanged) this.renderStateNode.value.needsUpdate = true;
    if (renderFrameChanged) this.renderFrameNode.value.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (!this.preset.bounds) this.mesh.frustumCulled = false;
  }

  private getParticleSpeed(slot: number, particle: Particle): number {
    if (!this.authoritativeReadbackAvailable) return particle.velocity.length();
    const offset = slot * 4;
    return tempVectorC.set(this.velocityLifeData[offset + 0], this.velocityLifeData[offset + 1], this.velocityLifeData[offset + 2]).length();
  }

  private getParticleVelocity(slot: number, particle: Particle, target: THREE.Vector3): THREE.Vector3 {
    if (!this.authoritativeReadbackAvailable) return target.copy(particle.velocity);
    const offset = slot * 4;
    return target.set(this.velocityLifeData[offset + 0], this.velocityLifeData[offset + 1], this.velocityLifeData[offset + 2]);
  }

  private getParticleAngularVelocity(slot: number, particle: Particle): number {
    const rbs = this.preset.rotationBySpeed;
    if (!rbs?.angularVelocity || !rbs.speedRange) return particle.angularVelocity;
    const speed = slot >= 0 ? this.getParticleSpeed(slot, particle) : particle.velocity.length();
    return evaluateCurve(rbs.angularVelocity, speedToParam(speed, rbs.speedRange), 0);
  }

  private getTextureSheetFrame(particle: Particle, t: number): number {
    const sheet = this.textureSheetConfig;
    if (!sheet) return 0;

    let frame = particle.startFrame;
    if (sheet.frameOverLifetime) frame += Math.floor(t * sheet.totalFrames);
    return THREE.MathUtils.clamp(frame, 0, sheet.totalFrames - 1);
  }
}
