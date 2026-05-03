import * as THREE from "three";

export type Range = number | [number, number];
export type Vec3Tuple = [number, number, number];
export type Vec3Range = Vec3Tuple | [Vec3Tuple, Vec3Tuple];
export type BlendMode = "alpha" | "additive" | "multiply";
export type AlignMode = "camera" | "velocity";
export type SimulationMode = "cpu" | "gpu" | "auto";
export type Curve = Array<[time: number, value: number]>;
export type Gradient = Array<[time: number, color: THREE.ColorRepresentation]>;

export type EmitterShape =
  | { type: "point" }
  | { type: "sphere"; radius?: number; emitFrom?: "volume" | "shell" }
  | { type: "hemisphere"; radius?: number; emitFrom?: "volume" | "shell" }
  | { type: "cone"; radius?: number; angle?: number; length?: number }
  | { type: "box"; size?: Vec3Tuple };

export type ParticlePreset = {
  name?: string;
  simulation?: SimulationMode;
  maxParticles?: number;
  duration?: number;
  loop?: boolean;
  prewarm?: boolean;
  autoDispose?: boolean;

  gpu?: {
    textureSize?: number;
    maxSpawnPerFrame?: number;
    forceCpuFallback?: boolean;
  };

  emitter?: EmitterShape;

  emission?: {
    rateOverTime?: Range;
    bursts?: Array<{ time: number; count: Range; probability?: number }>;
  };

  start?: {
    lifetime?: Range;
    speed?: Range;
    size?: Range;
    rotation?: Range;
    angularVelocity?: Range;
    color?: THREE.ColorRepresentation | [THREE.ColorRepresentation, THREE.ColorRepresentation];
    opacity?: Range;
    velocity?: Vec3Range;
  };

  forces?: {
    gravity?: Vec3Tuple;
    drag?: number;
    noise?: { strength?: number; frequency?: number };
  };

  overLifetime?: {
    size?: Curve;
    opacity?: Curve;
    color?: Gradient;
  };

  renderer?: {
    texture?: THREE.Texture;
    blendMode?: BlendMode;
    align?: AlignMode;
    depthWrite?: boolean;
    depthTest?: boolean;
    textureSheet?: {
      columns: number;
      rows: number;
      frameOverLifetime?: boolean;
      randomStartFrame?: boolean;
    };
  };
};

export type ParticleSystemOptions = {
  renderer?: THREE.WebGLRenderer;
};

export type ParticleWorldOptions = {
  renderer?: THREE.WebGLRenderer;
};

type Particle = {
  alive: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  lifetime: number;
  startSize: number;
  startOpacity: number;
  startColor: THREE.Color;
  rotation: number;
  angularVelocity: number;
  randomSeed: number;
  startFrame: number;
};

type SpawnRequest = {
  start: number;
  count: number;
  seed: number;
};

interface ParticleBackend {
  readonly object: THREE.Object3D;
  readonly isAlive: boolean;
  readonly isPlaying: boolean;
  readonly isComplete: boolean;
  readonly isDisposed: boolean;
  play(): void;
  pause(): void;
  stop(options?: { clear?: boolean }): void;
  restart(): void;
  emit(count: number): void;
  update(dt: number, camera: THREE.Camera): void;
  dispose(options?: { disposeTexture?: boolean }): void;
}

const DEFAULT_EMITTER: EmitterShape = { type: "point" };

const tempColorA = new THREE.Color();
const tempColorB = new THREE.Color();
const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();
const tempMatrixA = new THREE.Matrix4();

function randomRange(value: Range = 1): number {
  return Array.isArray(value) ? THREE.MathUtils.lerp(value[0], value[1], Math.random()) : value;
}

function rangeMinMax(value: Range | undefined, fallback: number): [number, number] {
  if (value === undefined) return [fallback, fallback];
  return Array.isArray(value) ? value : [value, value];
}

function vec3MinMax(value: Vec3Range | undefined, fallback: Vec3Tuple = [0, 0, 0]): [Vec3Tuple, Vec3Tuple] {
  if (!value) return [fallback, fallback];
  if (Array.isArray(value[0])) return value as [Vec3Tuple, Vec3Tuple];
  return [value as Vec3Tuple, value as Vec3Tuple];
}

function randomVec3(value: Vec3Range = [0, 0, 0]): THREE.Vector3 {
  if (Array.isArray(value[0])) {
    const [a, b] = value as [Vec3Tuple, Vec3Tuple];
    return new THREE.Vector3(
      THREE.MathUtils.lerp(a[0], b[0], Math.random()),
      THREE.MathUtils.lerp(a[1], b[1], Math.random()),
      THREE.MathUtils.lerp(a[2], b[2], Math.random())
    );
  }
  const v = value as Vec3Tuple;
  return new THREE.Vector3(v[0], v[1], v[2]);
}

function colorMinMax(value: THREE.ColorRepresentation | [THREE.ColorRepresentation, THREE.ColorRepresentation] | undefined): [THREE.Color, THREE.Color] {
  if (!value) return [new THREE.Color("#ffffff"), new THREE.Color("#ffffff")];
  if (Array.isArray(value)) return [new THREE.Color(value[0]), new THREE.Color(value[1])];
  const c = new THREE.Color(value);
  return [c.clone(), c.clone()];
}

function randomColor(value: THREE.ColorRepresentation | [THREE.ColorRepresentation, THREE.ColorRepresentation] = "#ffffff"): THREE.Color {
  if (Array.isArray(value)) {
    tempColorA.set(value[0]);
    tempColorB.set(value[1]);
    return tempColorA.clone().lerp(tempColorB, Math.random());
  }
  return new THREE.Color(value);
}

function evaluateCurve(curve: Curve | undefined, t: number, fallback = 1): number {
  if (!curve || curve.length === 0) return fallback;
  if (t <= curve[0][0]) return curve[0][1];

  for (let i = 0; i < curve.length - 1; i++) {
    const [t0, v0] = curve[i];
    const [t1, v1] = curve[i + 1];
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / Math.max(0.00001, t1 - t0);
      return THREE.MathUtils.lerp(v0, v1, u);
    }
  }

  return curve[curve.length - 1][1];
}

function evaluateGradient(gradient: Gradient | undefined, t: number, target: THREE.Color): THREE.Color {
  if (!gradient || gradient.length === 0) return target.set("#ffffff");
  if (t <= gradient[0][0]) return target.set(gradient[0][1]);

  for (let i = 0; i < gradient.length - 1; i++) {
    const [t0, c0] = gradient[i];
    const [t1, c1] = gradient[i + 1];
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / Math.max(0.00001, t1 - t0);
      tempColorA.set(c0);
      tempColorB.set(c1);
      return target.copy(tempColorA).lerp(tempColorB, u);
    }
  }

  return target.set(gradient[gradient.length - 1][1]);
}

function randomUnitVector(): THREE.Vector3 {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a));
}

function sampleEmitter(shape: EmitterShape = DEFAULT_EMITTER): { position: THREE.Vector3; direction: THREE.Vector3 } {
  switch (shape.type) {
    case "sphere": {
      const radius = shape.radius ?? 1;
      const direction = randomUnitVector();
      const distance = shape.emitFrom === "shell" ? radius : radius * Math.cbrt(Math.random());
      return { position: direction.clone().multiplyScalar(distance), direction };
    }
    case "hemisphere": {
      const radius = shape.radius ?? 1;
      const direction = randomUnitVector();
      if (direction.y < 0) direction.y *= -1;
      const distance = shape.emitFrom === "shell" ? radius : radius * Math.cbrt(Math.random());
      return { position: direction.clone().multiplyScalar(distance), direction };
    }
    case "cone": {
      const radius = shape.radius ?? 0.1;
      const angle = THREE.MathUtils.degToRad(shape.angle ?? 25);
      const length = shape.length ?? 1;
      const r = Math.sqrt(Math.random()) * radius;
      const a = Math.random() * Math.PI * 2;
      const position = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      const spread = Math.tan(angle) * length;
      const target = new THREE.Vector3((Math.random() * 2 - 1) * spread, length, (Math.random() * 2 - 1) * spread);
      return { position, direction: target.normalize() };
    }
    case "box": {
      const size = shape.size ?? [1, 1, 1];
      return {
        position: new THREE.Vector3((Math.random() - 0.5) * size[0], (Math.random() - 0.5) * size[1], (Math.random() - 0.5) * size[2]),
        direction: randomUnitVector(),
      };
    }
    case "point":
    default:
      return { position: new THREE.Vector3(), direction: randomUnitVector() };
  }
}

function makeDefaultParticleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create particle texture canvas context.");

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.8)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function applyBlendMode(material: THREE.Material, blendMode: BlendMode = "alpha"): void {
  if (blendMode === "additive") material.blending = THREE.AdditiveBlending;
  else if (blendMode === "multiply") material.blending = THREE.MultiplyBlending;
  else material.blending = THREE.NormalBlending;
}

function makeParticleMaterial(options: NonNullable<ParticlePreset["renderer"]> = {}): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: options.depthWrite ?? false,
    depthTest: options.depthTest ?? true,
    uniforms: { uTexture: { value: options.texture ?? makeDefaultParticleTexture() } },
    vertexShader: `
      attribute vec4 particleColor;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        vUv = uv;
        vColor = particleColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        vec4 tex = texture2D(uTexture, vUv);
        vec4 outColor = tex * vColor;
        if (outColor.a < 0.001) discard;
        gl_FragColor = outColor;
      }
    `,
  });

  applyBlendMode(material, options.blendMode ?? "alpha");
  return material;
}

function makeCurveTexture(curve: Curve | undefined, fallback = 1): THREE.DataTexture {
  const width = 256;
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const v = THREE.MathUtils.clamp(evaluateCurve(curve, t, fallback), 0, 1);
    const b = Math.round(v * 255);
    data[i * 4 + 0] = b;
    data[i * 4 + 1] = b;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function makeGradientTexture(gradient: Gradient | undefined): THREE.DataTexture {
  const width = 256;
  const data = new Uint8Array(width * 4);
  const color = new THREE.Color();
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    evaluateGradient(gradient, t, color);
    data[i * 4 + 0] = Math.round(THREE.MathUtils.clamp(color.r, 0, 1) * 255);
    data[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(color.g, 0, 1) * 255);
    data[i * 4 + 2] = Math.round(THREE.MathUtils.clamp(color.b, 0, 1) * 255);
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

class CPUParticleBackend implements ParticleBackend {
  readonly object = new THREE.Object3D();
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;

  private particles: Particle[] = [];
  private positions: Float32Array;
  private uvs: Float32Array;
  private colors: Float32Array;
  private positionAttribute: THREE.BufferAttribute;
  private uvAttribute: THREE.BufferAttribute;
  private colorAttribute: THREE.BufferAttribute;
  private maxParticles: number;
  private elapsed = 0;
  private emissionAccumulator = 0;
  private playing = false;
  private emissionComplete = false;
  private burstCursor = 0;
  private _disposed = false;
  private sortedBursts: Array<{ time: number; count: Range; probability?: number }>;

  constructor(private preset: ParticlePreset) {
    this.maxParticles = preset.maxParticles ?? 256;
    this.sortedBursts = [...(preset.emission?.bursts ?? [])].sort((a, b) => a.time - b.time);

    this.geometry = new THREE.BufferGeometry();
    const vertexCount = this.maxParticles * 6;
    this.positions = new Float32Array(vertexCount * 3);
    this.uvs = new Float32Array(vertexCount * 2);
    this.colors = new Float32Array(vertexCount * 4);

    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.uvAttribute = new THREE.BufferAttribute(this.uvs, 2);
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 4);

    this.geometry.setAttribute("position", this.positionAttribute);
    this.geometry.setAttribute("uv", this.uvAttribute);
    this.geometry.setAttribute("particleColor", this.colorAttribute);
    this.geometry.setDrawRange(0, 0);

    this.material = makeParticleMaterial(preset.renderer);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.object.add(this.mesh);

    for (let i = 0; i < this.maxParticles; i++) this.particles.push(this.createDeadParticle());
    if (preset.prewarm) this.prewarm();
  }

  get isAlive(): boolean {
    return this.particles.some((p) => p.alive);
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
    this.elapsed = 0;
    this.emissionAccumulator = 0;
    this.burstCursor = 0;

    if (clear) {
      for (const particle of this.particles) particle.alive = false;
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

  update(dt: number, camera: THREE.Camera): void {
    if (this._disposed) return;

    const duration = this.preset.duration ?? 1;
    const loop = this.preset.loop ?? false;

    if (this.playing) {
      this.elapsed += dt;

      if (loop && this.elapsed > duration) {
        this.elapsed %= duration;
        this.burstCursor = 0;
        this.emissionComplete = false;
      }

      if (!loop && this.elapsed > duration) {
        this.playing = false;
        this.emissionComplete = true;
      } else {
        this.updateEmission(dt);
      }
    }

    this.updateParticles(dt);
    this.updateGeometry(camera);
  }

  dispose({ disposeTexture = false } = {}): void {
    if (this._disposed) return;
    this.object.removeFromParent();
    this.geometry.dispose();

    const texture = this.material.uniforms.uTexture?.value as THREE.Texture | undefined;
    this.material.dispose();
    if (disposeTexture && texture) texture.dispose();

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
    this.elapsed = 0;
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
      if (this.elapsed < burst.time) break;
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

    const sheet = this.preset.renderer?.textureSheet;
    const totalFrames = sheet ? sheet.columns * sheet.rows : 1;
    particle.startFrame = sheet?.randomStartFrame ? Math.floor(Math.random() * totalFrames) : 0;
  }

  private updateParticles(dt: number): void {
    const forces = this.preset.forces ?? {};
    const gravity = tempVectorA.set(...(forces.gravity ?? [0, 0, 0]));
    const drag = forces.drag ?? 0;
    const noiseStrength = forces.noise?.strength ?? 0;
    const noiseFrequency = forces.noise?.frequency ?? 1;

    for (const particle of this.particles) {
      if (!particle.alive) continue;

      particle.age += dt;
      if (particle.age >= particle.lifetime) {
        particle.alive = false;
        continue;
      }

      particle.velocity.addScaledVector(gravity, dt);

      if (noiseStrength > 0) {
        const f = noiseFrequency;
        const s = noiseStrength;
        const seed = particle.randomSeed;
        particle.velocity.x += Math.sin((particle.age + seed) * f * 1.17) * s * dt;
        particle.velocity.y += Math.sin((particle.age + seed) * f * 1.71) * s * dt;
        particle.velocity.z += Math.cos((particle.age + seed) * f * 1.31) * s * dt;
      }

      if (drag > 0) particle.velocity.multiplyScalar(Math.max(0, 1 - drag * dt));
      particle.position.addScaledVector(particle.velocity, dt);
      particle.rotation += particle.angularVelocity * dt;
    }
  }

  private updateGeometry(camera: THREE.Camera): void {
    const align = this.preset.renderer?.align ?? "camera";
    const cameraRight = tempVectorA.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const cameraUp = tempVectorB.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

    let vertexOffset = 0;
    let uvOffset = 0;
    let colorOffset = 0;
    let aliveCount = 0;

    for (const particle of this.particles) {
      if (!particle.alive) continue;

      const t = THREE.MathUtils.clamp(particle.age / particle.lifetime, 0, 1);
      const over = this.preset.overLifetime ?? {};
      const size = particle.startSize * evaluateCurve(over.size, t, 1);
      const opacity = particle.startOpacity * evaluateCurve(over.opacity, t, 1);
      const lifeColor = evaluateGradient(over.color, t, tempColorA);
      const finalColor = tempColorB.copy(particle.startColor).multiply(lifeColor);

      let right = cameraRight;
      let up = cameraUp;

      if (align === "velocity" && particle.velocity.lengthSq() > 0.0001) {
        right = tempVectorC.copy(particle.velocity).normalize();
        up = tempVectorB.setFromMatrixColumn(camera.matrixWorld, 2).cross(right).normalize();
        if (up.lengthSq() < 0.0001) up = cameraUp;
      }

      const half = size * 0.5;
      const cos = Math.cos(particle.rotation);
      const sin = Math.sin(particle.rotation);
      const r = right.clone().multiplyScalar(half);
      const u = up.clone().multiplyScalar(half);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]] as const;
      const uv = this.getParticleUvs(particle, t);
      const uvs = [[uv.u0, uv.v1], [uv.u1, uv.v1], [uv.u1, uv.v0], [uv.u0, uv.v1], [uv.u1, uv.v0], [uv.u0, uv.v0]] as const;

      for (let i = 0; i < 6; i++) {
        const x = corners[i][0];
        const y = corners[i][1];
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        const corner = particle.position.clone().addScaledVector(r, rx).addScaledVector(u, ry);

        this.positions[vertexOffset++] = corner.x;
        this.positions[vertexOffset++] = corner.y;
        this.positions[vertexOffset++] = corner.z;
        this.uvs[uvOffset++] = uvs[i][0];
        this.uvs[uvOffset++] = uvs[i][1];
        this.colors[colorOffset++] = finalColor.r;
        this.colors[colorOffset++] = finalColor.g;
        this.colors[colorOffset++] = finalColor.b;
        this.colors[colorOffset++] = opacity;
      }

      aliveCount++;
    }

    this.geometry.setDrawRange(0, aliveCount * 6);
    this.positionAttribute.needsUpdate = true;
    this.uvAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
    if (aliveCount > 0) this.geometry.computeBoundingSphere();
  }

  private getParticleUvs(particle: Particle, t: number): { u0: number; v0: number; u1: number; v1: number } {
    const sheet = this.preset.renderer?.textureSheet;
    if (!sheet) return { u0: 0, v0: 0, u1: 1, v1: 1 };

    const totalFrames = sheet.columns * sheet.rows;
    let frame = particle.startFrame;
    if (sheet.frameOverLifetime) frame += Math.floor(t * totalFrames);
    frame = THREE.MathUtils.clamp(frame, 0, totalFrames - 1);

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

class GPUParticleBackend implements ParticleBackend {
  readonly object = new THREE.Object3D();
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;

  private textureSize: number;
  private maxParticles: number;
  private capacity: number;
  private elapsed = 0;
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
  private previousRenderTarget: THREE.WebGLRenderTarget | null = null;
  private previousXrEnabled = false;

  constructor(private preset: ParticlePreset, private renderer: THREE.WebGLRenderer) {
    this.maxParticles = preset.maxParticles ?? 1024;
    this.textureSize = preset.gpu?.textureSize ?? Math.ceil(Math.sqrt(this.maxParticles));
    this.capacity = this.textureSize * this.textureSize;
    this.sortedBursts = [...(preset.emission?.bursts ?? [])].sort((a, b) => a.time - b.time);

    this.sizeCurveTexture = makeCurveTexture(preset.overLifetime?.size, 1);
    this.opacityCurveTexture = makeCurveTexture(preset.overLifetime?.opacity, 1);
    this.colorGradientTexture = makeGradientTexture(preset.overLifetime?.color);

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
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.object.add(this.mesh);

    if (preset.prewarm) this.prewarm();
  }

  get isAlive(): boolean {
    // GPU readback would defeat the point. We conservatively keep one-shots alive until the maximum possible lifetime has elapsed.
    if (this.preset.loop) return this.playing;
    const [, lifetimeMax] = rangeMinMax(this.preset.start?.lifetime, 1);
    return this.elapsed <= (this.preset.duration ?? 1) + lifetimeMax;
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
    this.elapsed = 0;
    this.emissionAccumulator = 0;
    this.burstCursor = 0;
    this.queuedSpawns.length = 0;
    if (clear) this.clearTargets();
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

  update(dt: number, camera: THREE.Camera): void {
    if (this._disposed) return;

    const duration = this.preset.duration ?? 1;
    const loop = this.preset.loop ?? false;

    if (this.playing) {
      this.elapsed += dt;

      if (loop && this.elapsed > duration) {
        this.elapsed %= duration;
        this.burstCursor = 0;
        this.emissionComplete = false;
      }

      if (!loop && this.elapsed > duration) {
        this.playing = false;
        this.emissionComplete = true;
      } else {
        this.updateEmission(dt);
      }
    }

    this.runSimulation(dt);
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
    this.rtA.forEach((rt) => rt.dispose());
    this.rtB.forEach((rt) => rt.dispose());

    const texture = this.material.uniforms.uTexture?.value as THREE.Texture | undefined;
    if (disposeTexture && texture) texture.dispose();
    this._disposed = true;
  }

  private prewarm(): void {
    const duration = this.preset.duration ?? 1;
    const step = 1 / 30;
    this.play();
    for (let t = 0; t < duration; t += step) this.update(step, new THREE.PerspectiveCamera());
    this.elapsed = 0;
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
      if (this.elapsed < burst.time) break;
      if (Math.random() <= (burst.probability ?? 1)) this.emit(Math.floor(randomRange(burst.count)));
      this.burstCursor++;
    }
  }

  private runSimulation(dt: number): void {
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
    const sheet = this.preset.renderer?.textureSheet;
    const totalFrames = sheet ? sheet.columns * sheet.rows : 1;

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
    u.uGravity.value.set(...(forces.gravity ?? [0, 0, 0]));
    u.uDrag.value = forces.drag ?? 0;
    u.uNoiseStrength.value = forces.noise?.strength ?? 0;
    u.uNoiseFrequency.value = forces.noise?.frequency ?? 1;
    u.uRandomStartFrame.value = sheet?.randomStartFrame ? 1 : 0;
    u.uTotalFrames.value = totalFrames;
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
        uGravity: { value: new THREE.Vector3() },
        uDrag: { value: 0 },
        uNoiseStrength: { value: 0 },
        uNoiseFrequency: { value: 1 },
        uRandomStartFrame: { value: 0 },
        uTotalFrames: { value: 1 },
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

        uniform vec3 uGravity;
        uniform float uDrag;
        uniform float uNoiseStrength;
        uniform float uNoiseFrequency;
        uniform int uRandomStartFrame;
        uniform int uTotalFrames;

        float hash(float n) { return fract(sin(n) * 43758.5453123); }
        float rand(float index, float salt) { return hash(index * 17.131 + salt * 113.71 + uSpawnSeed); }

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
            vec3 velocity = dir * speed + inheritedVelocity;
            vec3 color = mix(uColorMin, uColorMax, rand(rawIndex, 16.0));
            float seed = rand(rawIndex, 17.0) * 1000.0;
            float size = mix(uSizeRange.x, uSizeRange.y, rand(rawIndex, 18.0));
            float rotation = mix(uRotationRange.x, uRotationRange.y, rand(rawIndex, 19.0));
            float angularVelocity = mix(uAngularVelocityRange.x, uAngularVelocityRange.y, rand(rawIndex, 20.0));
            float opacity = mix(uOpacityRange.x, uOpacityRange.y, rand(rawIndex, 21.0));
            float frame = uRandomStartFrame == 1 ? floor(rand(rawIndex, 22.0) * float(uTotalFrames)) : 0.0;

            if (uTarget == 0) gl_FragColor = vec4(pos, 0.0);
            else if (uTarget == 1) gl_FragColor = vec4(velocity, max(0.01, life));
            else if (uTarget == 2) gl_FragColor = vec4(color, seed);
            else gl_FragColor = vec4(size, rotation, angularVelocity + frame * 10000.0, opacity + 2.0);
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

          velocity += uGravity * uDeltaTime;

          if (uNoiseStrength > 0.0) {
            float f = uNoiseFrequency;
            float seed = colorSeed.a;
            velocity.x += sin((age + seed) * f * 1.17) * uNoiseStrength * uDeltaTime;
            velocity.y += sin((age + seed) * f * 1.71) * uNoiseStrength * uDeltaTime;
            velocity.z += cos((age + seed) * f * 1.31) * uNoiseStrength * uDeltaTime;
          }

          if (uDrag > 0.0) velocity *= max(0.0, 1.0 - uDrag * uDeltaTime);
          pos += velocity * uDeltaTime;
          extra.y += extra.z * uDeltaTime;

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
    const sheet = this.preset.renderer?.textureSheet;
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: this.preset.renderer?.depthWrite ?? false,
      depthTest: this.preset.renderer?.depthTest ?? true,
      uniforms: {
        uPositionAge: { value: this.readTargets[0].texture },
        uVelocityLife: { value: this.readTargets[1].texture },
        uColorSeed: { value: this.readTargets[2].texture },
        uExtra: { value: this.readTargets[3].texture },
        uTexture: { value: this.preset.renderer?.texture ?? makeDefaultParticleTexture() },
        uSizeCurve: { value: this.sizeCurveTexture },
        uOpacityCurve: { value: this.opacityCurveTexture },
        uColorGradient: { value: this.colorGradientTexture },
        uCameraRight: { value: new THREE.Vector3(1, 0, 0) },
        uCameraUp: { value: new THREE.Vector3(0, 1, 0) },
        uCameraForward: { value: new THREE.Vector3(0, 0, 1) },
        uAlignVelocity: { value: this.preset.renderer?.align === "velocity" ? 1 : 0 },
        uSheetColumns: { value: sheet?.columns ?? 1 },
        uSheetRows: { value: sheet?.rows ?? 1 },
        uSheetFrameOverLifetime: { value: sheet?.frameOverLifetime ? 1 : 0 },
        uTotalFrames: { value: sheet ? sheet.columns * sheet.rows : 1 },
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
        uniform vec3 uCameraRight;
        uniform vec3 uCameraUp;
        uniform vec3 uCameraForward;
        uniform int uAlignVelocity;
        uniform int uSheetColumns;
        uniform int uSheetRows;
        uniform int uSheetFrameOverLifetime;
        uniform int uTotalFrames;

        varying vec2 vUv;
        varying vec4 vColor;

        void main() {
          vec4 positionAge = texture2D(uPositionAge, particleUv);
          vec4 velocityLife = texture2D(uVelocityLife, particleUv);
          vec4 colorSeed = texture2D(uColorSeed, particleUv);
          vec4 extra = texture2D(uExtra, particleUv);

          float alive = extra.a > 1.0 ? 1.0 : 0.0;
          float ageT = clamp(positionAge.w / max(0.0001, velocityLife.w), 0.0, 1.0);
          float sizeMul = texture2D(uSizeCurve, vec2(ageT, 0.5)).r;
          float opacityMul = texture2D(uOpacityCurve, vec2(ageT, 0.5)).r;
          vec3 lifeColor = texture2D(uColorGradient, vec2(ageT, 0.5)).rgb;

          float startSize = extra.x;
          float rotation = extra.y;
          float startOpacity = max(0.0, extra.a - 2.0);
          float size = startSize * sizeMul;
          float opacity = startOpacity * opacityMul * alive;

          vec3 worldCenter = (modelMatrix * vec4(positionAge.xyz, 1.0)).xyz;
          vec3 right = normalize(uCameraRight);
          vec3 up = normalize(uCameraUp);

          if (uAlignVelocity == 1 && length(velocityLife.xyz) > 0.0001) {
            right = normalize(mat3(modelMatrix) * normalize(velocityLife.xyz));
            up = normalize(cross(uCameraForward, right));
            if (length(up) < 0.0001) up = normalize(uCameraUp);
          }

          float c = cos(rotation);
          float s = sin(rotation);
          vec2 rc = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
          vec3 worldPos = worldCenter + right * rc.x * size * 0.5 + up * rc.y * size * 0.5;

          vec2 atlasUv = uv;
          if (uTotalFrames > 1) {
            float encoded = extra.z;
            float startFrame = floor(encoded / 10000.0);
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
          vColor = vec4(colorSeed.rgb * lifeColor, opacity);
          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uTexture;
        varying vec2 vUv;
        varying vec4 vColor;
        void main() {
          vec4 tex = texture2D(uTexture, vUv);
          vec4 outColor = tex * vColor;
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
  }
}

function shouldUseGpu(preset: ParticlePreset, options: ParticleSystemOptions): boolean {
  if (preset.gpu?.forceCpuFallback) return false;
  if (preset.simulation === "cpu") return false;
  if (preset.simulation === "gpu") return !!options.renderer;
  if (preset.simulation === "auto") return !!options.renderer && (preset.maxParticles ?? 0) >= 2048;
  return false;
}

export class ParticleSystem extends THREE.Object3D {
  readonly preset: ParticlePreset;
  readonly backendType: "cpu" | "gpu";
  private backend: ParticleBackend;

  constructor(preset: ParticlePreset = {}, options: ParticleSystemOptions = {}) {
    super();
    this.preset = preset;

    if (preset.simulation === "gpu" && !options.renderer) {
      console.warn("Particle preset requested GPU simulation, but no WebGLRenderer was provided. Falling back to CPU.");
    }

    const useGpu = shouldUseGpu(preset, options);
    this.backendType = useGpu ? "gpu" : "cpu";
    this.backend = useGpu ? new GPUParticleBackend(preset, options.renderer!) : new CPUParticleBackend(preset);
    this.add(this.backend.object);
  }

  get isAlive(): boolean {
    return this.backend.isAlive;
  }

  get isPlaying(): boolean {
    return this.backend.isPlaying;
  }

  get isComplete(): boolean {
    return this.backend.isComplete;
  }

  get isDisposed(): boolean {
    return this.backend.isDisposed;
  }

  play(): this {
    this.backend.play();
    return this;
  }

  pause(): this {
    this.backend.pause();
    return this;
  }

  stop(options?: { clear?: boolean }): this {
    this.backend.stop(options);
    return this;
  }

  restart(): this {
    this.backend.restart();
    return this;
  }

  emit(count: number): this {
    this.backend.emit(count);
    return this;
  }

  update(dt: number, camera: THREE.Camera): void {
    this.backend.update(dt, camera);
  }

  dispose(options?: { disposeTexture?: boolean }): void {
    this.backend.dispose(options);
    this.removeFromParent();
  }
}

export class ParticleEffectLibrary {
  private presets = new Map<string, ParticlePreset>();
  private defaultParent?: THREE.Object3D;
  private renderer?: THREE.WebGLRenderer;

  constructor(presets: Record<string, ParticlePreset> = {}, defaultParent?: THREE.Object3D, options: ParticleWorldOptions = {}) {
    this.defaultParent = defaultParent;
    this.renderer = options.renderer;
    Object.entries(presets).forEach(([name, preset]) => this.register(name, preset));
  }

  register(name: string, preset: ParticlePreset): this {
    this.presets.set(name, { ...preset, name });
    return this;
  }

  get(name: string): ParticlePreset | undefined {
    return this.presets.get(name);
  }

  spawn(
    name: string,
    options: {
      position?: THREE.Vector3 | Vec3Tuple;
      rotation?: THREE.Euler;
      quaternion?: THREE.Quaternion;
      scale?: number;
      parent?: THREE.Object3D;
      autoPlay?: boolean;
      renderer?: THREE.WebGLRenderer;
    } = {}
  ): ParticleSystem {
    const preset = this.presets.get(name);
    if (!preset) throw new Error(`Unknown particle effect "${name}".`);

    const system = new ParticleSystem(preset, { renderer: options.renderer ?? this.renderer });
    if (options.position) Array.isArray(options.position) ? system.position.set(...options.position) : system.position.copy(options.position);
    if (options.rotation) system.rotation.copy(options.rotation);
    if (options.quaternion) system.quaternion.copy(options.quaternion);
    if (typeof options.scale === "number") system.scale.setScalar(options.scale);

    const parent = options.parent ?? this.defaultParent;
    if (parent) parent.add(system);
    if (options.autoPlay ?? true) system.play();
    return system;
  }
}

export class ParticleWorld {
  readonly effects: ParticleEffectLibrary;
  readonly systems = new Set<ParticleSystem>();

  constructor(private parent: THREE.Object3D, presets: Record<string, ParticlePreset> = {}, private options: ParticleWorldOptions = {}) {
    this.effects = new ParticleEffectLibrary(presets, parent, options);
  }

  register(name: string, preset: ParticlePreset): this {
    this.effects.register(name, preset);
    return this;
  }

  spawn(name: string, options: Parameters<ParticleEffectLibrary["spawn"]>[1] = {}): ParticleSystem {
    const system = this.effects.spawn(name, { parent: this.parent, renderer: this.options.renderer, ...options });
    this.systems.add(system);
    return system;
  }

  update(dt: number, camera: THREE.Camera): void {
    for (const system of [...this.systems]) {
      system.update(dt, camera);
      if ((system.preset.autoDispose ?? true) && system.isComplete) {
        system.dispose();
        this.systems.delete(system);
      }
    }
  }

  clear(): void {
    for (const system of this.systems) system.dispose();
    this.systems.clear();
  }
}
