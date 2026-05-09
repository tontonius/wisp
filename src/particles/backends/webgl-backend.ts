import * as THREE from "three";
import type { ParticleBackend, ParticlePreset, Range, SimulationSpace, SoftParticleDepthTextureOptions, SpawnRequest } from "../types";
import { DEFAULT_EMITTER, PARTICLE_DISPERSAL_GLSL, applyBlendMode, colorMinMax, getDispersalAmountCurvePlaceholder, getDispersalWhitePlaceholderTexture, getTextureSheetConfig, isRendererDispersalEnabled, makeCurveFloatTexture, makeCurveTexture, makeDispersalAmountCurveTexture, makeGradientTexture, makeVectorCurveTexture, randomRange, rangeMinMax, resolveRendererTexture, tempMatrixA, tempVectorA, tempVectorB, tempVectorC, vec3MinMax } from "../shared";

export class WebGLParticleBackend implements ParticleBackend {
  readonly object = new THREE.Object3D();
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;

  private textureSize: number;
  private maxParticles: number;
  private capacity: number;
  private _elapsed = 0;
  private emissionAccumulator = 0;
  private playing = false;
  private emissionComplete = false;
  private _disposed = false;
  private burstCursor = 0;
  private spawnCursor = 0;
  private sortedBursts: Array<{ time: number; count: Range; probability?: number }>;
  private queuedSpawns: SpawnRequest[] = [];

  private simScene = new THREE.Scene();
  private simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private simQuad: THREE.Mesh;
  private simMaterial: THREE.ShaderMaterial;

  private rtA: THREE.WebGLRenderTarget[] = [];
  private rtB: THREE.WebGLRenderTarget[] = [];
  private readTargets: THREE.WebGLRenderTarget[];
  private writeTargets: THREE.WebGLRenderTarget[];

  private sizeCurveTexture: THREE.DataTexture;
  private opacityCurveTexture: THREE.DataTexture;
  private colorGradientTexture: THREE.DataTexture;
  private lifetimeVelocityTexture: THREE.DataTexture;
  private sizeBySpeedCurveTexture: THREE.DataTexture;
  private colorBySpeedGradientTexture: THREE.DataTexture;
  private rotationBySpeedCurveTexture: THREE.DataTexture;
  private pointAttractorStrengthCurveTexture: THREE.DataTexture;
  private dispersalAmountCurveTexture: THREE.DataTexture | null = null;
  private previousRenderTarget: THREE.WebGLRenderTarget | null = null;
  private previousXrEnabled = false;
  private simulationSpace: SimulationSpace;

  constructor(private preset: ParticlePreset, private renderer: THREE.WebGLRenderer) {
    this.maxParticles = preset.maxParticles ?? 1024;
    this.simulationSpace = preset.simulationSpace ?? "local";
    this.textureSize = preset.gpu?.textureSize ?? Math.ceil(Math.sqrt(this.maxParticles));
    this.capacity = this.textureSize * this.textureSize;
    this.sortedBursts = [...(preset.emission?.bursts ?? [])].sort((a, b) => a.time - b.time);

    this.sizeCurveTexture = makeCurveTexture(preset.overLifetime?.size, 1);
    this.opacityCurveTexture = makeCurveTexture(preset.overLifetime?.opacity, 1);
    this.colorGradientTexture = makeGradientTexture(preset.overLifetime?.color);
    this.lifetimeVelocityTexture = makeVectorCurveTexture(preset.velocityOverLifetime);
    this.sizeBySpeedCurveTexture = makeCurveFloatTexture(preset.sizeBySpeed?.curve, 1);
    this.colorBySpeedGradientTexture = makeGradientTexture(preset.colorBySpeed?.gradient);
    this.rotationBySpeedCurveTexture = makeCurveFloatTexture(preset.rotationBySpeed?.angularVelocity, 0);
    this.pointAttractorStrengthCurveTexture = makeCurveFloatTexture(preset.forces?.pointAttractor?.strengthOverLifetime, 1);
    if (isRendererDispersalEnabled(preset.renderer) && preset.renderer?.dispersal?.amount) {
      this.dispersalAmountCurveTexture = makeDispersalAmountCurveTexture(preset.renderer.dispersal.amount);
    }

    this.rtA = this.makeTargetSet();
    this.rtB = this.makeTargetSet();
    this.readTargets = this.rtA;
    this.writeTargets = this.rtB;
    this.clearTargets();

    this.simMaterial = this.makeSimulationMaterial();
    this.simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMaterial);
    this.simScene.add(this.simQuad);

    this.geometry = this.makeRenderGeometry();
    this.material = this.makeRenderMaterial();
    if (this.dispersalAmountCurveTexture) {
      this.material.uniforms.uDispersalAmountCurve.value = this.dispersalAmountCurveTexture;
    }
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.applyExplicitBounds();
    this.object.add(this.mesh);
    this.applySpeedDrivenRenderUniforms();

    if (preset.prewarm) this.prewarm();
  }

  private applySpeedDrivenRenderUniforms(): void {
    const u = this.material.uniforms;
    const p = this.preset;
    u.uSizeBySpeedEnabled.value = p.sizeBySpeed ? 1 : 0;
    const sbr = p.sizeBySpeed?.speedRange ?? [0, 1];
    u.uSizeBySpeedRange.value.set(sbr[0], sbr[1]);
    u.uSizeBySpeedCurve.value = this.sizeBySpeedCurveTexture;
    u.uColorBySpeedEnabled.value = p.colorBySpeed ? 1 : 0;
    const cbr = p.colorBySpeed?.speedRange ?? [0, 1];
    u.uColorBySpeedRange.value.set(cbr[0], cbr[1]);
    u.uColorBySpeedGradient.value = this.colorBySpeedGradientTexture;
  }

  private applyExplicitBounds(): void {
    const bounds = this.preset.bounds;
    if (!bounds) {
      this.mesh.frustumCulled = false;
      return;
    }
    const center = bounds.center ?? [0, 0, 0];
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(center[0], center[1], center[2]), bounds.radius);
    this.mesh.frustumCulled = true;
  }

  get isAlive(): boolean {
    // GPU readback would defeat the point. We conservatively keep one-shots alive until the maximum possible lifetime has elapsed.
    if (this.preset.loop) return this.playing;
    const [, lifetimeMax] = rangeMinMax(this.preset.start?.lifetime, 1);
    return this._elapsed <= (this.preset.duration ?? 1) + lifetimeMax;
  }

  get aliveCount(): number {
    return this.isAlive ? this.maxParticles : 0;
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
    this.queuedSpawns.length = 0;
    if (clear) {
      this.spawnCursor = 0;
      this.clearTargets();
    }
  }

  restart(): void {
    this.stop({ clear: true });
    this.play();
  }

  emit(count: number): void {
    if (count <= 0) return;
    const maxSpawn = this.preset.gpu?.maxSpawnPerFrame ?? this.maxParticles;
    let remaining = Math.min(count, maxSpawn);

    while (remaining > 0) {
      const availableToEnd = this.maxParticles - this.spawnCursor;
      const batch = Math.min(remaining, availableToEnd);
      this.queuedSpawns.push({ start: this.spawnCursor, count: batch, seed: Math.random() * 10000 });
      this.spawnCursor = (this.spawnCursor + batch) % this.maxParticles;
      remaining -= batch;
    }
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

    const simulationDt = this.playing ? dt : 0;
    this.runSimulation(simulationDt);
    this.updateRenderUniforms(camera);
  }

  dispose({ disposeTexture = false } = {}): void {
    if (this._disposed) return;
    this.object.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.simMaterial.dispose();
    this.simQuad.geometry.dispose();
    this.sizeCurveTexture.dispose();
    this.opacityCurveTexture.dispose();
    this.colorGradientTexture.dispose();
    this.lifetimeVelocityTexture.dispose();
    this.sizeBySpeedCurveTexture.dispose();
    this.colorBySpeedGradientTexture.dispose();
    this.rotationBySpeedCurveTexture.dispose();
    this.pointAttractorStrengthCurveTexture.dispose();
    this.dispersalAmountCurveTexture?.dispose();
    this.rtA.forEach((rt) => rt.dispose());
    this.rtB.forEach((rt) => rt.dispose());

    const texture = this.material.uniforms.uTexture?.value as THREE.Texture | undefined;
    const dispersalMap = this.preset.renderer?.dispersal?.texture;
    if (disposeTexture && texture) texture.dispose();
    if (disposeTexture && dispersalMap && dispersalMap !== texture) dispersalMap.dispose();
    this._disposed = true;
  }

  private prewarm(): void {
    const duration = this.preset.duration ?? 1;
    const step = 1 / 30;
    this.play();
    for (let t = 0; t < duration; t += step) this.update(step, new THREE.PerspectiveCamera());
    this._elapsed = 0;
    this.burstCursor = 0;
  }

  private makeTargetSet(): THREE.WebGLRenderTarget[] {
    const targets: THREE.WebGLRenderTarget[] = [];
    for (let i = 0; i < 4; i++) {
      const rt = new THREE.WebGLRenderTarget(this.textureSize, this.textureSize, {
        type: THREE.FloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
      });
      targets.push(rt);
    }
    return targets;
  }

  private clearTargets(): void {
    const oldTarget = this.renderer.getRenderTarget();
    const oldColor = new THREE.Color();
    this.renderer.getClearColor(oldColor);
    const oldAlpha = this.renderer.getClearAlpha();

    this.renderer.setClearColor(0x000000, 0);
    for (const rt of [...this.rtA, ...this.rtB]) {
      this.renderer.setRenderTarget(rt);
      this.renderer.clear(true, false, false);
    }
    this.renderer.setRenderTarget(oldTarget);
    this.renderer.setClearColor(oldColor, oldAlpha);
  }

  private updateEmission(dt: number): void {
    const rate = randomRange(this.preset.emission?.rateOverTime ?? 0);
    this.emissionAccumulator += rate * dt;

    const continuousCount = Math.floor(this.emissionAccumulator);
    if (continuousCount > 0) {
      this.emit(continuousCount);
      this.emissionAccumulator -= continuousCount;
    }

    while (this.burstCursor < this.sortedBursts.length) {
      const burst = this.sortedBursts[this.burstCursor];
      if (this._elapsed < burst.time) break;
      if (Math.random() <= (burst.probability ?? 1)) this.emit(Math.floor(randomRange(burst.count)));
      this.burstCursor++;
    }
  }

  private runSimulation(dt: number): void {
    if (dt === 0 && this.queuedSpawns.length === 0) return;
    const spawns = this.queuedSpawns.length > 0 ? this.queuedSpawns.splice(0) : [{ start: -1, count: 0, seed: 0 }];

    this.previousRenderTarget = this.renderer.getRenderTarget();
    this.previousXrEnabled = this.renderer.xr.enabled;
    this.renderer.xr.enabled = false;

    for (let i = 0; i < spawns.length; i++) {
      this.runSimulationPass(i === 0 ? dt : 0, spawns[i]);
    }

    this.renderer.setRenderTarget(this.previousRenderTarget);
    this.renderer.xr.enabled = this.previousXrEnabled;

    this.material.uniforms.uPositionAge.value = this.readTargets[0].texture;
    this.material.uniforms.uVelocityLife.value = this.readTargets[1].texture;
    this.material.uniforms.uColorSeed.value = this.readTargets[2].texture;
    this.material.uniforms.uExtra.value = this.readTargets[3].texture;
  }

  private runSimulationPass(dt: number, spawn: SpawnRequest): void {
    this.setSimulationUniforms(dt, spawn);

    for (let target = 0; target < 4; target++) {
      this.simMaterial.uniforms.uTarget.value = target;
      this.renderer.setRenderTarget(this.writeTargets[target]);
      this.renderer.render(this.simScene, this.simCamera);
    }

    const oldRead = this.readTargets;
    this.readTargets = this.writeTargets;
    this.writeTargets = oldRead;
  }

  private setSimulationUniforms(dt: number, spawn: SpawnRequest): void {
    const start = this.preset.start ?? {};
    const forces = this.preset.forces ?? {};
    const emitter = this.preset.emitter ?? DEFAULT_EMITTER;

    const [lifeMin, lifeMax] = rangeMinMax(start.lifetime, 1);
    const [speedMin, speedMax] = rangeMinMax(start.speed, 1);
    const [sizeMin, sizeMax] = rangeMinMax(start.size, 0.2);
    const [opacityMin, opacityMax] = rangeMinMax(start.opacity, 1);
    const [rotationMin, rotationMax] = rangeMinMax(start.rotation, 0);
    const [angularMin, angularMax] = rangeMinMax(start.angularVelocity, 0);
    const [velocityMin, velocityMax] = vec3MinMax(start.velocity, [0, 0, 0]);
    const [colorMin, colorMax] = colorMinMax(start.color);

    const emitterType = emitter.type === "sphere" ? 1 : emitter.type === "hemisphere" ? 2 : emitter.type === "cone" ? 3 : emitter.type === "box" ? 4 : 0;
    const emitterRadius = "radius" in emitter ? emitter.radius ?? 1 : 0;
    const emitterShell = "emitFrom" in emitter && emitter.emitFrom === "shell" ? 1 : 0;
    const emitterAngle = emitter.type === "cone" ? THREE.MathUtils.degToRad(emitter.angle ?? 25) : 0;
    const emitterLength = emitter.type === "cone" ? emitter.length ?? 1 : 1;
    const emitterSize = emitter.type === "box" ? emitter.size ?? [1, 1, 1] : [1, 1, 1];
    const sheet = getTextureSheetConfig(this.preset);

    const u = this.simMaterial.uniforms;
    u.uPrevPositionAge.value = this.readTargets[0].texture;
    u.uPrevVelocityLife.value = this.readTargets[1].texture;
    u.uPrevColorSeed.value = this.readTargets[2].texture;
    u.uPrevExtra.value = this.readTargets[3].texture;
    u.uDeltaTime.value = dt;
    u.uTime.value = performance.now() / 1000;
    u.uTextureSize.value = this.textureSize;
    u.uMaxParticles.value = this.maxParticles;
    u.uSpawnStart.value = spawn.start;
    u.uSpawnCount.value = spawn.count;
    u.uSpawnSeed.value = spawn.seed;
    u.uEmitterType.value = emitterType;
    u.uEmitterRadius.value = emitterRadius;
    u.uEmitterShell.value = emitterShell;
    u.uEmitterAngle.value = emitterAngle;
    u.uEmitterLength.value = emitterLength;
    u.uEmitterSize.value.set(...emitterSize);
    u.uLifeRange.value.set(lifeMin, lifeMax);
    u.uSpeedRange.value.set(speedMin, speedMax);
    u.uSizeRange.value.set(sizeMin, sizeMax);
    u.uOpacityRange.value.set(opacityMin, opacityMax);
    u.uRotationRange.value.set(rotationMin, rotationMax);
    u.uAngularVelocityRange.value.set(angularMin, angularMax);
    u.uVelocityMin.value.set(...velocityMin);
    u.uVelocityMax.value.set(...velocityMax);
    u.uColorMin.value.copy(colorMin);
    u.uColorMax.value.copy(colorMax);
    u.uAcceleration.value.set(...(forces.acceleration ?? [0, 0, 0]));
    u.uDrag.value = forces.drag ?? 0;
    const pointAttractor = forces.pointAttractor;
    u.uPointAttractorEnabled.value = pointAttractor ? 1 : 0;
    u.uPointAttractorCenter.value.set(...(pointAttractor?.center ?? [0, 0, 0]));
    u.uPointAttractorStrength.value = pointAttractor?.strength ?? 0;
    u.uPointAttractorEpsilon.value = pointAttractor?.epsilon ?? 1e-4;
    u.uPointAttractorStrengthCurve.value = this.pointAttractorStrengthCurveTexture;
    const vortex = forces.vortex;
    const vortexAxis = tempVectorA.set(...(vortex?.axis ?? [0, 1, 0]));
    if (vortexAxis.lengthSq() < 1e-8) vortexAxis.set(0, 1, 0);
    else vortexAxis.normalize();
    u.uVortexEnabled.value = vortex ? 1 : 0;
    u.uVortexCenter.value.set(...(vortex?.center ?? [0, 0, 0]));
    u.uVortexAxis.value.copy(vortexAxis);
    u.uVortexOrbitalSpeed.value = vortex?.orbitalSpeed ?? 0;
    u.uVortexInward.value = vortex?.inward ?? 0;
    u.uVortexUpward.value = vortex?.upward ?? 0;
    u.uNoiseStrength.value = forces.noise?.strength ?? 0;
    u.uNoiseFrequency.value = forces.noise?.frequency ?? 1;
    u.uNoiseScroll.value.set(...(forces.noise?.scroll ?? [0.2, 0.35, 0.17]));
    u.uNoiseOctaves.value = THREE.MathUtils.clamp(Math.floor(forces.noise?.octaves ?? 2), 1, 4);
    u.uNoiseLacunarity.value = Math.max(1, forces.noise?.lacunarity ?? 2);
    u.uNoisePersistence.value = THREE.MathUtils.clamp(forces.noise?.persistence ?? 0.5, 0.05, 1);
    const rbs = this.preset.rotationBySpeed;
    u.uRotationBySpeedEnabled.value = rbs ? 1 : 0;
    const rbr = rbs?.speedRange ?? [0, 1];
    u.uRotationBySpeedRange.value.set(rbr[0], rbr[1]);
    u.uRotationBySpeedCurve.value = this.rotationBySpeedCurveTexture;
    u.uLifetimeVelocity.value = this.lifetimeVelocityTexture;
    u.uRandomStartFrame.value = sheet?.randomFrame ? 1 : 0;
    u.uTotalFrames.value = sheet?.totalFrames ?? 1;
    u.uSimulationSpace.value = this.simulationSpace === "world" ? 1 : 0;
    this.object.updateWorldMatrix(true, false);
    u.uSystemWorldMatrix.value.copy(this.object.matrixWorld);
    tempMatrixA.copy(this.object.matrixWorld).setPosition(0, 0, 0);
    u.uSystemWorldNormalMatrix.value.setFromMatrix4(tempMatrixA).invert().transpose();
  }

  private makeSimulationMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uPrevPositionAge: { value: null },
        uPrevVelocityLife: { value: null },
        uPrevColorSeed: { value: null },
        uPrevExtra: { value: null },
        uTarget: { value: 0 },
        uDeltaTime: { value: 0 },
        uTime: { value: 0 },
        uTextureSize: { value: this.textureSize },
        uMaxParticles: { value: this.maxParticles },
        uSpawnStart: { value: -1 },
        uSpawnCount: { value: 0 },
        uSpawnSeed: { value: 0 },
        uEmitterType: { value: 0 },
        uEmitterRadius: { value: 1 },
        uEmitterShell: { value: 0 },
        uEmitterAngle: { value: 0 },
        uEmitterLength: { value: 1 },
        uEmitterSize: { value: new THREE.Vector3(1, 1, 1) },
        uLifeRange: { value: new THREE.Vector2(1, 1) },
        uSpeedRange: { value: new THREE.Vector2(1, 1) },
        uSizeRange: { value: new THREE.Vector2(0.2, 0.2) },
        uOpacityRange: { value: new THREE.Vector2(1, 1) },
        uRotationRange: { value: new THREE.Vector2(0, 0) },
        uAngularVelocityRange: { value: new THREE.Vector2(0, 0) },
        uVelocityMin: { value: new THREE.Vector3() },
        uVelocityMax: { value: new THREE.Vector3() },
        uColorMin: { value: new THREE.Color("#ffffff") },
        uColorMax: { value: new THREE.Color("#ffffff") },
        uAcceleration: { value: new THREE.Vector3() },
        uDrag: { value: 0 },
        uPointAttractorEnabled: { value: 0 },
        uPointAttractorCenter: { value: new THREE.Vector3() },
        uPointAttractorStrength: { value: 0 },
        uPointAttractorEpsilon: { value: 1e-4 },
        uPointAttractorStrengthCurve: { value: this.pointAttractorStrengthCurveTexture },
        uVortexEnabled: { value: 0 },
        uVortexCenter: { value: new THREE.Vector3() },
        uVortexAxis: { value: new THREE.Vector3(0, 1, 0) },
        uVortexOrbitalSpeed: { value: 0 },
        uVortexInward: { value: 0 },
        uVortexUpward: { value: 0 },
        uNoiseStrength: { value: 0 },
        uNoiseFrequency: { value: 1 },
        uNoiseScroll: { value: new THREE.Vector3(0.2, 0.35, 0.17) },
        uNoiseOctaves: { value: 2 },
        uNoiseLacunarity: { value: 2 },
        uNoisePersistence: { value: 0.5 },
        uRotationBySpeedEnabled: { value: 0 },
        uRotationBySpeedRange: { value: new THREE.Vector2(0, 1) },
        uRotationBySpeedCurve: { value: this.rotationBySpeedCurveTexture },
        uLifetimeVelocity: { value: this.lifetimeVelocityTexture },
        uRandomStartFrame: { value: 0 },
        uTotalFrames: { value: 1 },
        uSimulationSpace: { value: this.simulationSpace === "world" ? 1 : 0 },
        uSystemWorldMatrix: { value: new THREE.Matrix4() },
        uSystemWorldNormalMatrix: { value: new THREE.Matrix3() },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec2 vUv;

        uniform sampler2D uPrevPositionAge;
        uniform sampler2D uPrevVelocityLife;
        uniform sampler2D uPrevColorSeed;
        uniform sampler2D uPrevExtra;

        uniform int uTarget;
        uniform float uDeltaTime;
        uniform float uTime;
        uniform float uTextureSize;
        uniform int uMaxParticles;
        uniform int uSpawnStart;
        uniform int uSpawnCount;
        uniform float uSpawnSeed;

        uniform int uEmitterType;
        uniform float uEmitterRadius;
        uniform int uEmitterShell;
        uniform float uEmitterAngle;
        uniform float uEmitterLength;
        uniform vec3 uEmitterSize;

        uniform vec2 uLifeRange;
        uniform vec2 uSpeedRange;
        uniform vec2 uSizeRange;
        uniform vec2 uOpacityRange;
        uniform vec2 uRotationRange;
        uniform vec2 uAngularVelocityRange;
        uniform vec3 uVelocityMin;
        uniform vec3 uVelocityMax;
        uniform vec3 uColorMin;
        uniform vec3 uColorMax;

        uniform vec3 uAcceleration;
        uniform float uDrag;
        uniform int uPointAttractorEnabled;
        uniform vec3 uPointAttractorCenter;
        uniform float uPointAttractorStrength;
        uniform float uPointAttractorEpsilon;
        uniform sampler2D uPointAttractorStrengthCurve;
        uniform int uVortexEnabled;
        uniform vec3 uVortexCenter;
        uniform vec3 uVortexAxis;
        uniform float uVortexOrbitalSpeed;
        uniform float uVortexInward;
        uniform float uVortexUpward;
        uniform float uNoiseStrength;
        uniform float uNoiseFrequency;
        uniform vec3 uNoiseScroll;
        uniform int uNoiseOctaves;
        uniform float uNoiseLacunarity;
        uniform float uNoisePersistence;
        uniform int uRotationBySpeedEnabled;
        uniform vec2 uRotationBySpeedRange;
        uniform sampler2D uRotationBySpeedCurve;
        uniform sampler2D uLifetimeVelocity;
        uniform int uRandomStartFrame;
        uniform int uTotalFrames;
        uniform int uSimulationSpace;
        uniform mat4 uSystemWorldMatrix;
        uniform mat3 uSystemWorldNormalMatrix;

        float hash(float n) { return fract(sin(n) * 43758.5453123); }
        float rand(float index, float salt) { return hash(index * 17.131 + salt * 113.71 + uSpawnSeed); }
        float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
        vec3 smooth3(vec3 t) { return t * t * (3.0 - 2.0 * t); }
        float valueNoise3(vec3 p) {
          vec3 i = floor(p);
          vec3 f = smooth3(fract(p));
          float c000 = hash3(i + vec3(0.0, 0.0, 0.0));
          float c100 = hash3(i + vec3(1.0, 0.0, 0.0));
          float c010 = hash3(i + vec3(0.0, 1.0, 0.0));
          float c110 = hash3(i + vec3(1.0, 1.0, 0.0));
          float c001 = hash3(i + vec3(0.0, 0.0, 1.0));
          float c101 = hash3(i + vec3(1.0, 0.0, 1.0));
          float c011 = hash3(i + vec3(0.0, 1.0, 1.0));
          float c111 = hash3(i + vec3(1.0, 1.0, 1.0));
          float x00 = mix(c000, c100, f.x);
          float x10 = mix(c010, c110, f.x);
          float x01 = mix(c001, c101, f.x);
          float x11 = mix(c011, c111, f.x);
          float y0 = mix(x00, x10, f.y);
          float y1 = mix(x01, x11, f.y);
          return mix(y0, y1, f.z);
        }
        float fbmNoise3(vec3 p, int octaves, float lacunarity, float persistence) {
          float sum = 0.0;
          float norm = 0.0;
          float amp = 1.0;
          float freq = 1.0;
          for (int i = 0; i < 4; i++) {
            if (i >= octaves) break;
            sum += valueNoise3(p * freq) * amp;
            norm += amp;
            freq *= lacunarity;
            amp *= persistence;
          }
          return norm > 0.0 ? sum / norm : 0.0;
        }

        vec3 randomUnitVector(float index) {
          float z = rand(index, 1.0) * 2.0 - 1.0;
          float a = rand(index, 2.0) * 6.28318530718;
          float r = sqrt(max(0.0, 1.0 - z * z));
          return vec3(r * cos(a), z, r * sin(a));
        }

        vec3 sampleEmitterPosition(float index, out vec3 direction) {
          if (uEmitterType == 1 || uEmitterType == 2) {
            direction = randomUnitVector(index);
            if (uEmitterType == 2 && direction.y < 0.0) direction.y *= -1.0;
            float d = uEmitterShell == 1 ? uEmitterRadius : uEmitterRadius * pow(rand(index, 3.0), 1.0 / 3.0);
            return direction * d;
          }

          if (uEmitterType == 3) {
            float r = sqrt(rand(index, 4.0)) * uEmitterRadius;
            float a = rand(index, 5.0) * 6.28318530718;
            vec3 pos = vec3(cos(a) * r, 0.0, sin(a) * r);
            float spread = tan(uEmitterAngle) * uEmitterLength;
            vec3 target = vec3((rand(index, 6.0) * 2.0 - 1.0) * spread, uEmitterLength, (rand(index, 7.0) * 2.0 - 1.0) * spread);
            direction = normalize(target);
            return pos;
          }

          if (uEmitterType == 4) {
            direction = randomUnitVector(index);
            return (vec3(rand(index, 8.0), rand(index, 9.0), rand(index, 10.0)) - 0.5) * uEmitterSize;
          }

          direction = randomUnitVector(index);
          return vec3(0.0);
        }

        bool isSpawned(int index) {
          if (uSpawnStart < 0 || uSpawnCount <= 0) return false;
          int endIndex = uSpawnStart + uSpawnCount;
          if (endIndex <= uMaxParticles) return index >= uSpawnStart && index < endIndex;
          return index >= uSpawnStart || index < (endIndex - uMaxParticles);
        }

        void main() {
          vec4 positionAge = texture2D(uPrevPositionAge, vUv);
          vec4 velocityLife = texture2D(uPrevVelocityLife, vUv);
          vec4 colorSeed = texture2D(uPrevColorSeed, vUv);
          vec4 extra = texture2D(uPrevExtra, vUv);

          float rawIndex = floor(gl_FragCoord.y) * uTextureSize + floor(gl_FragCoord.x);
          int index = int(rawIndex);

          if (index >= uMaxParticles) {
            gl_FragColor = vec4(0.0);
            return;
          }

          bool spawn = isSpawned(index);

          if (spawn) {
            vec3 dir;
            vec3 pos = sampleEmitterPosition(rawIndex, dir);
            float life = mix(uLifeRange.x, uLifeRange.y, rand(rawIndex, 11.0));
            float speed = mix(uSpeedRange.x, uSpeedRange.y, rand(rawIndex, 12.0));
            vec3 inheritedVelocity = mix(uVelocityMin, uVelocityMax, vec3(rand(rawIndex, 13.0), rand(rawIndex, 14.0), rand(rawIndex, 15.0)));
            if (uSimulationSpace == 1) {
              pos = (uSystemWorldMatrix * vec4(pos, 1.0)).xyz;
              dir = normalize(uSystemWorldNormalMatrix * dir);
              inheritedVelocity = uSystemWorldNormalMatrix * inheritedVelocity;
            }
            vec3 velocity = dir * speed + inheritedVelocity;
            vec3 color = mix(uColorMin, uColorMax, rand(rawIndex, 16.0));
            float seed = rand(rawIndex, 17.0) * 1000.0;
            float size = mix(uSizeRange.x, uSizeRange.y, rand(rawIndex, 18.0));
            float rotation = mix(uRotationRange.x, uRotationRange.y, rand(rawIndex, 19.0));
            float angularVelocity = mix(uAngularVelocityRange.x, uAngularVelocityRange.y, rand(rawIndex, 20.0));
            float opacity = mix(uOpacityRange.x, uOpacityRange.y, rand(rawIndex, 21.0));
            float startFrame = uRandomStartFrame == 1 ? floor(rand(rawIndex, 22.0) * float(uTotalFrames)) : 0.0;

            if (uTarget == 0) gl_FragColor = vec4(pos, 0.0);
            else if (uTarget == 1) gl_FragColor = vec4(velocity, max(0.01, life));
            else if (uTarget == 2) gl_FragColor = vec4(color, seed);
            else gl_FragColor = vec4(size, rotation, angularVelocity, opacity + 2.0 + startFrame * 10000.0);
            return;
          }

          float alive = extra.a > 1.0 ? 1.0 : 0.0;
          if (alive < 0.5) {
            gl_FragColor = vec4(0.0);
            return;
          }

          vec3 pos = positionAge.xyz;
          float age = positionAge.w + uDeltaTime;
          vec3 velocity = velocityLife.xyz;
          float life = velocityLife.w;

          if (age >= life) {
            gl_FragColor = vec4(0.0);
            return;
          }

          velocity += uAcceleration * uDeltaTime;

          if (uPointAttractorEnabled == 1) {
            float ageT = clamp(age / max(0.0001, life), 0.0, 1.0);
            float paMul = texture2D(uPointAttractorStrengthCurve, vec2(ageT, 0.5)).r;
            float paEff = uPointAttractorStrength * paMul;
            if (abs(paEff) > 0.000001) {
              vec3 toCenter = uPointAttractorCenter - pos;
              float dist = length(toCenter);
              if (dist > uPointAttractorEpsilon) {
                velocity += (toCenter / dist) * paEff * uDeltaTime;
              }
            }
          }

          if (uVortexEnabled == 1) {
            vec3 radial = pos - uVortexCenter;
            float axialDist = dot(radial, uVortexAxis);
            vec3 radialPlane = radial - uVortexAxis * axialDist;
            float radialLen = length(radialPlane);
            if (radialLen > 0.00001) {
              vec3 radialDir = radialPlane / radialLen;
              vec3 tangent = cross(uVortexAxis, radialDir);
              float tangentLen = length(tangent);
              if (tangentLen > 0.00001) {
                velocity += (tangent / tangentLen) * uVortexOrbitalSpeed * uDeltaTime;
              }
              velocity -= radialDir * uVortexInward * uDeltaTime;
            }
            velocity += uVortexAxis * uVortexUpward * uDeltaTime;
          }

          if (uNoiseStrength > 0.0) {
            vec3 noiseP = pos * uNoiseFrequency + uNoiseScroll * uTime + vec3(colorSeed.a * 0.01);
            float nx = fbmNoise3(noiseP + vec3(17.1, 3.2, 5.9), uNoiseOctaves, uNoiseLacunarity, uNoisePersistence) * 2.0 - 1.0;
            float ny = fbmNoise3(noiseP + vec3(-11.4, 19.7, 7.3), uNoiseOctaves, uNoiseLacunarity, uNoisePersistence) * 2.0 - 1.0;
            float nz = fbmNoise3(noiseP + vec3(4.8, -13.6, 23.1), uNoiseOctaves, uNoiseLacunarity, uNoisePersistence) * 2.0 - 1.0;
            velocity += vec3(nx, ny, nz) * uNoiseStrength * uDeltaTime;
          }

          if (uDrag > 0.0) velocity *= max(0.0, 1.0 - uDrag * uDeltaTime);
          float ageT = clamp(age / max(0.0001, life), 0.0, 1.0);
          vec3 lifetimeVelocity = texture2D(uLifetimeVelocity, vec2(ageT, 0.5)).rgb;
          pos += (velocity + lifetimeVelocity) * uDeltaTime;
          float angularVel = extra.z;
          if (uRotationBySpeedEnabled == 1) {
            float spd = length(velocity);
            float ts = clamp((spd - uRotationBySpeedRange.x) / max(uRotationBySpeedRange.y - uRotationBySpeedRange.x, 0.00001), 0.0, 1.0);
            angularVel = texture2D(uRotationBySpeedCurve, vec2(ts, 0.5)).r;
            extra.z = angularVel;
          }
          extra.y += angularVel * uDeltaTime;

          if (uTarget == 0) gl_FragColor = vec4(pos, age);
          else if (uTarget == 1) gl_FragColor = vec4(velocity, life);
          else if (uTarget == 2) gl_FragColor = colorSeed;
          else gl_FragColor = extra;
        }
      `,
    });
  }

  private makeRenderGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertexCount = this.maxParticles * 6;
    const positions = new Float32Array(vertexCount * 3);
    const corners = new Float32Array(vertexCount * 2);
    const particleUvs = new Float32Array(vertexCount * 2);
    const baseUvs = new Float32Array(vertexCount * 2);

    const quadCorners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]] as const;
    const quadUvs = [[0, 1], [1, 1], [1, 0], [0, 1], [1, 0], [0, 0]] as const;

    let pi = 0;
    let ci = 0;
    let pui = 0;
    let bui = 0;

    for (let i = 0; i < this.maxParticles; i++) {
      const x = (i % this.textureSize + 0.5) / this.textureSize;
      const y = (Math.floor(i / this.textureSize) + 0.5) / this.textureSize;

      for (let v = 0; v < 6; v++) {
        positions[pi++] = 0;
        positions[pi++] = 0;
        positions[pi++] = 0;
        corners[ci++] = quadCorners[v][0];
        corners[ci++] = quadCorners[v][1];
        particleUvs[pui++] = x;
        particleUvs[pui++] = y;
        baseUvs[bui++] = quadUvs[v][0];
        baseUvs[bui++] = quadUvs[v][1];
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("corner", new THREE.BufferAttribute(corners, 2));
    geometry.setAttribute("particleUv", new THREE.BufferAttribute(particleUvs, 2));
    geometry.setAttribute("uv", new THREE.BufferAttribute(baseUvs, 2));
    geometry.setDrawRange(0, vertexCount);
    return geometry;
  }

  private makeRenderMaterial(): THREE.ShaderMaterial {
    const sheet = getTextureSheetConfig(this.preset);
    const softParticlesEnabled = this.preset.renderer?.softParticles ?? false;
    const dispersal = this.preset.renderer?.dispersal;
    const dispersalEnabled = isRendererDispersalEnabled(this.preset.renderer);
    const dispersalMap = dispersal?.texture ?? null;
    const resolvedTexture = resolveRendererTexture(this.preset.renderer ?? {});
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: this.preset.renderer?.depthWrite ?? false,
      depthTest: this.preset.renderer?.depthTest ?? true,
      uniforms: {
        uPositionAge: { value: this.readTargets[0].texture },
        uVelocityLife: { value: this.readTargets[1].texture },
        uColorSeed: { value: this.readTargets[2].texture },
        uExtra: { value: this.readTargets[3].texture },
        uTexture: { value: resolvedTexture },
        uSceneDepth: { value: null },
        uSceneDepthSize: { value: new THREE.Vector2(1, 1) },
        uSoftParticles: { value: softParticlesEnabled ? 1 : 0 },
        uSoftness: { value: this.preset.renderer?.softness ?? 1.5 },
        uCameraNearFar: { value: new THREE.Vector2(0.1, 2000) },
        uCameraIsPerspective: { value: 1 },
        uSizeCurve: { value: this.sizeCurveTexture },
        uOpacityCurve: { value: this.opacityCurveTexture },
        uColorGradient: { value: this.colorGradientTexture },
        uSizeBySpeedEnabled: { value: 0 },
        uSizeBySpeedRange: { value: new THREE.Vector2(0, 1) },
        uSizeBySpeedCurve: { value: this.sizeBySpeedCurveTexture },
        uColorBySpeedEnabled: { value: 0 },
        uColorBySpeedRange: { value: new THREE.Vector2(0, 1) },
        uColorBySpeedGradient: { value: this.colorBySpeedGradientTexture },
        uCameraRight: { value: new THREE.Vector3(1, 0, 0) },
        uCameraUp: { value: new THREE.Vector3(0, 1, 0) },
        uCameraForward: { value: new THREE.Vector3(0, 0, 1) },
        uAlignVelocity: { value: this.preset.renderer?.align === "velocity" ? 1 : 0 },
        uSheetColumns: { value: sheet?.columns ?? 1 },
        uSheetRows: { value: sheet?.rows ?? 1 },
        uSheetFrameOverLifetime: { value: sheet?.frameOverLifetime ? 1 : 0 },
        uTotalFrames: { value: sheet?.totalFrames ?? 1 },
        uSimulationSpace: { value: this.simulationSpace === "world" ? 1 : 0 },
        uDispersalEnabled: { value: dispersalEnabled ? 1 : 0 },
        uDispersalStrength: { value: dispersal?.strength ?? 1 },
        uDispersalNoiseScale: { value: dispersal?.noiseScale ?? 6 },
        uDispersalEdge: { value: dispersal?.edgeSoftness ?? 0.12 },
        uDispersalScroll: { value: new THREE.Vector2(dispersal?.scroll?.[0] ?? 0, dispersal?.scroll?.[1] ?? 0) },
        uDispersalTime: { value: 0 },
        uDispersalUseMap: { value: dispersalMap ? 1 : 0 },
        uDispersalMap: { value: dispersalMap ?? getDispersalWhitePlaceholderTexture() },
        uDispersalAmountCurve: { value: getDispersalAmountCurvePlaceholder() },
      },
      vertexShader: `
        precision highp float;

        attribute vec2 corner;
        attribute vec2 particleUv;

        uniform sampler2D uPositionAge;
        uniform sampler2D uVelocityLife;
        uniform sampler2D uColorSeed;
        uniform sampler2D uExtra;
        uniform sampler2D uSizeCurve;
        uniform sampler2D uOpacityCurve;
        uniform sampler2D uColorGradient;
        uniform int uSizeBySpeedEnabled;
        uniform vec2 uSizeBySpeedRange;
        uniform sampler2D uSizeBySpeedCurve;
        uniform int uColorBySpeedEnabled;
        uniform vec2 uColorBySpeedRange;
        uniform sampler2D uColorBySpeedGradient;
        uniform vec3 uCameraRight;
        uniform vec3 uCameraUp;
        uniform vec3 uCameraForward;
        uniform int uAlignVelocity;
        uniform int uSheetColumns;
        uniform int uSheetRows;
        uniform int uSheetFrameOverLifetime;
        uniform int uTotalFrames;
        uniform int uSimulationSpace;

        varying vec2 vUv;
        varying vec4 vColor;
        varying float vAgeT;
        varying float vDispersalSeed;

        void main() {
          vec4 positionAge = texture2D(uPositionAge, particleUv);
          vec4 velocityLife = texture2D(uVelocityLife, particleUv);
          vec4 colorSeed = texture2D(uColorSeed, particleUv);
          vec4 extra = texture2D(uExtra, particleUv);

          float alive = extra.a > 1.0 ? 1.0 : 0.0;
          float ageT = clamp(positionAge.w / max(0.0001, velocityLife.w), 0.0, 1.0);
          vAgeT = ageT;
          vDispersalSeed = fract(colorSeed.a * 0.1031 + dot(particleUv, vec2(12.9898, 78.233)));
          float sizeMul = texture2D(uSizeCurve, vec2(ageT, 0.5)).r;
          float opacityMul = texture2D(uOpacityCurve, vec2(ageT, 0.5)).r;
          vec3 lifeColor = texture2D(uColorGradient, vec2(ageT, 0.5)).rgb;

          float startSize = extra.x;
          float rotation = extra.y;
          float startFrame = floor(extra.a / 10000.0);
          float startOpacity = max(0.0, extra.a - startFrame * 10000.0 - 2.0);
          float spd = length(velocityLife.xyz);
          float speedTSize = clamp((spd - uSizeBySpeedRange.x) / max(uSizeBySpeedRange.y - uSizeBySpeedRange.x, 0.00001), 0.0, 1.0);
          float speedSizeMul = uSizeBySpeedEnabled == 1 ? texture2D(uSizeBySpeedCurve, vec2(speedTSize, 0.5)).r : 1.0;
          float size = startSize * sizeMul * speedSizeMul;
          float opacity = startOpacity * opacityMul * alive;

          vec3 worldCenter = uSimulationSpace == 1 ? positionAge.xyz : (modelMatrix * vec4(positionAge.xyz, 1.0)).xyz;
          vec3 right = normalize(uCameraRight);
          vec3 up = normalize(uCameraUp);

          if (uAlignVelocity == 1 && length(velocityLife.xyz) > 0.0001) {
            right = normalize(uSimulationSpace == 1 ? normalize(velocityLife.xyz) : (mat3(modelMatrix) * normalize(velocityLife.xyz)));
            up = normalize(cross(uCameraForward, right));
            if (length(up) < 0.0001) up = normalize(uCameraUp);
          }

          float c = cos(rotation);
          float s = sin(rotation);
          vec2 rc = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
          vec3 worldPos = worldCenter + right * rc.x * size * 0.5 + up * rc.y * size * 0.5;

          vec2 atlasUv = uv;
          if (uTotalFrames > 1) {
            float frame = startFrame;
            if (uSheetFrameOverLifetime == 1) frame += floor(ageT * float(uTotalFrames));
            frame = clamp(frame, 0.0, float(uTotalFrames - 1));
            float col = mod(frame, float(uSheetColumns));
            float row = floor(frame / float(uSheetColumns));
            vec2 tile = vec2(1.0 / float(uSheetColumns), 1.0 / float(uSheetRows));
            atlasUv.x = (col + uv.x) * tile.x;
            atlasUv.y = 1.0 - (row + (1.0 - uv.y)) * tile.y;
          }

          vUv = atlasUv;
          float speedTColor = clamp((spd - uColorBySpeedRange.x) / max(uColorBySpeedRange.y - uColorBySpeedRange.x, 0.00001), 0.0, 1.0);
          vec3 speedColor = uColorBySpeedEnabled == 1 ? texture2D(uColorBySpeedGradient, vec2(speedTColor, 0.5)).rgb : vec3(1.0);
          vColor = vec4(colorSeed.rgb * lifeColor * speedColor, opacity);
          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uTexture;
        uniform sampler2D uSceneDepth;
        uniform vec2 uSceneDepthSize;
        uniform int uSoftParticles;
        uniform float uSoftness;
        uniform vec2 uCameraNearFar;
        uniform int uCameraIsPerspective;
        uniform int uDispersalEnabled;
        uniform float uDispersalStrength;
        uniform float uDispersalNoiseScale;
        uniform float uDispersalEdge;
        uniform vec2 uDispersalScroll;
        uniform float uDispersalTime;
        uniform int uDispersalUseMap;
        uniform sampler2D uDispersalMap;
        uniform sampler2D uDispersalAmountCurve;
        varying vec2 vUv;
        varying vec4 vColor;
        varying float vAgeT;
        varying float vDispersalSeed;
        ${PARTICLE_DISPERSAL_GLSL}

        float linearizeDepth(float depth01) {
          float near = uCameraNearFar.x;
          float far = max(near + 0.0001, uCameraNearFar.y);
          if (uCameraIsPerspective == 1) {
            float z = depth01 * 2.0 - 1.0;
            return (2.0 * near * far) / (far + near - z * (far - near));
          }
          return mix(near, far, depth01);
        }

        void main() {
          vec4 tex = texture2D(uTexture, vUv);
          vec4 outColor = tex * vColor;
          if (uSoftParticles == 1) {
            vec2 uvDepth = gl_FragCoord.xy / max(uSceneDepthSize, vec2(1.0));
            float sceneDepth01 = texture2D(uSceneDepth, uvDepth).r;
            float sceneDepth = linearizeDepth(sceneDepth01);
            float particleDepth = linearizeDepth(gl_FragCoord.z);
            float fade = clamp((sceneDepth - particleDepth) * max(0.0001, uSoftness), 0.0, 1.0);
            outColor.a *= fade;
          }
          if (uDispersalEnabled == 1) {
            vec2 scroll = uDispersalScroll * uDispersalTime;
            vec2 dUvNoise = vUv * uDispersalNoiseScale + vec2(vDispersalSeed * 17.413, vDispersalSeed * 63.291) + scroll;
            vec2 dUvMap = (vUv - vec2(0.5)) * uDispersalNoiseScale + vec2(0.5) + scroll;
            float n = uDispersalUseMap == 1 ? texture2D(uDispersalMap, dUvMap).r : dispersalValueNoise(dUvNoise);
            float amount = texture2D(uDispersalAmountCurve, vec2(clamp(vAgeT, 0.0, 1.0), 0.5)).r;
            float m = dispersalMask(n, amount, uDispersalEdge);
            outColor.a *= mix(1.0, m, clamp(uDispersalStrength, 0.0, 1.0));
          }
          if (outColor.a < 0.001) discard;
          gl_FragColor = outColor;
        }
      `,
    });

    applyBlendMode(material, this.preset.renderer?.blendMode ?? "alpha");
    return material;
  }

  private updateRenderUniforms(camera: THREE.Camera): void {
    const cameraRight = tempVectorA.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const cameraUp = tempVectorB.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const cameraForward = tempVectorC.setFromMatrixColumn(camera.matrixWorld, 2).normalize();
    this.material.uniforms.uCameraRight.value.copy(cameraRight);
    this.material.uniforms.uCameraUp.value.copy(cameraUp);
    this.material.uniforms.uCameraForward.value.copy(cameraForward);
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      this.material.uniforms.uCameraNearFar.value.set(camera.near, camera.far);
    } else {
      this.material.uniforms.uCameraNearFar.value.set(0.1, 1000);
    }
    this.material.uniforms.uCameraIsPerspective.value = camera instanceof THREE.PerspectiveCamera ? 1 : 0;
    const udt = this.material.uniforms.uDispersalTime;
    if (udt) udt.value = this._elapsed;
  }
}
