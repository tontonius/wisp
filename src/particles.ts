import * as THREE from "three";
import { assertValidParticlePreset } from "./particle-preset-validation";

export type Range = number | [number, number];
export type Vec2Tuple = [number, number];
export type Vec3Tuple = [number, number, number];
export type Vec3Range = Vec3Tuple | [Vec3Tuple, Vec3Tuple];
export type BlendMode = "alpha" | "additive" | "multiply";
export type AlignMode = "camera" | "velocity";
export type RendererType = "billboard" | "stretchedBillboard";
export type SortMode = "none" | "distance" | "youngestFirst" | "oldestFirst";
export type SimulationMode = "cpu" | "gpu" | "auto";
export type SimulationSpace = "local" | "world";
export type ParticleBounds = {
  /** Bounding sphere center used for culling. */
  center?: Vec3Tuple;
  /** Bounding sphere radius used for culling. Must be > 0. */
  radius: number;
};
export type Curve = Array<[time: number, value: number]>;
export type Gradient = Array<[time: number, color: THREE.ColorRepresentation]>;
export type VelocityOverLifetime = {
  linear?: {
    x?: Curve;
    y?: Curve;
    z?: Curve;
  };
};

/** Remap `|velocity|` into `[0, 1]` using linear clamp between `speedRange[0]` and `speedRange[1]`. */
export type SpeedRemapRange = [number, number];

/** Multiply final RGB after start color × over-lifetime color. Sampled by speed parameter `t`. */
export type ColorBySpeed = {
  speedRange: SpeedRemapRange;
  gradient: Gradient;
};

/** Multiply size after `start.size ×` over-lifetime size curve. Sampled by speed parameter `t`. */
export type SizeBySpeed = {
  speedRange: SpeedRemapRange;
  curve: Curve;
};

/** Replaces per-frame angular velocity from `start.angularVelocity` when set. Sampled by speed parameter `t` (rad/s). */
export type RotationBySpeed = {
  speedRange: SpeedRemapRange;
  angularVelocity: Curve;
};

export type EmitterShape =
  | { type: "point" }
  | { type: "sphere"; radius?: number; emitFrom?: "volume" | "shell" }
  | { type: "hemisphere"; radius?: number; emitFrom?: "volume" | "shell" }
  | { type: "cone"; radius?: number; angle?: number; length?: number }
  | { type: "box"; size?: Vec3Tuple };

export type ParticleDebugOptions = {
  enabled?: boolean;
  emitter?: boolean;
  spawnDirection?: boolean;
  /** Draw explicit preset bounds sphere when `preset.bounds` is set. */
  bounds?: boolean;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  segments?: number;
};

/** CPU-only infinite plane with normal +Y (`xz` plane). Coordinates are in `simulationSpace` (`local` by default). */
export type CpuPlaneCollision = {
  type: "plane";
  /** Plane height along simulation-space Y. Default `0`. */
  y?: number;
  /** Restitution on the plane normal: outgoing `velocity.y` is `-bounce * incoming_velocity_y` when moving into the plane from above. Default `0.4`. */
  bounce?: number;
  /** After a bounce, horizontal velocity (`x`, `z`) is multiplied by this factor. Default `1` (no tangential damping). */
  dampening?: number;
  /** When true, particles die on penetrating the plane instead of bouncing. */
  killOnCollision?: boolean;
};

/** CPU-only sphere collision in `simulationSpace` (`local` by default). */
export type CpuSphereCollision = {
  type: "sphere";
  /** Sphere center in simulation space. Default `[0, 0, 0]`. */
  center?: Vec3Tuple;
  /** Sphere radius. Default `1`. */
  radius?: number;
  /** Restitution on the contact normal. Default `0.4`. */
  bounce?: number;
  /** Tangential damping after collision response. Default `1`. */
  dampening?: number;
  /** When true, particles die on collision instead of bouncing/sliding. */
  killOnCollision?: boolean;
};

/** CPU-only axis-aligned box collision in `simulationSpace` (`local` by default). */
export type CpuBoxCollision = {
  type: "box";
  /** Box center in simulation space. Default `[0, 0, 0]`. */
  center?: Vec3Tuple;
  /** Full box size on each axis. Default `[1, 1, 1]`. */
  size?: Vec3Tuple;
  /** Restitution on the contact normal. Default `0.4`. */
  bounce?: number;
  /** Tangential damping after collision response. Default `1`. */
  dampening?: number;
  /** When true, particles die on collision instead of bouncing/sliding. */
  killOnCollision?: boolean;
};

export type CpuCollision = CpuPlaneCollision | CpuSphereCollision | CpuBoxCollision;

/** Spatial dissolve / breakup of billboard alpha over lifetime (CPU and GPU). */
export type ParticleRendererDispersal = {
  /** When `false`, dispersal is off. When `true` or omitted with `dispersal` set, dispersal runs. Default `true` when `renderer.dispersal` is present. */
  enabled?: boolean;
  /** Blend toward the noise dissolve mask (`0` = uniform alpha only, `1` = full mask). Default `1`. */
  strength?: number;
  /** Remaps normalized age to dissolve amount (`0` = no cutoff, `1` = full dissolve). Omit for linear `age`. */
  amount?: Curve;
  /** Multiplier on billboard UVs when sampling noise / map. Default `6`. */
  noiseScale?: number;
  /** Edge softness for the dissolve threshold. Default `0.12`. */
  edgeSoftness?: number;
  /** Optional grayscale map; **R** channel is compared to the dissolve threshold. Omit for procedural value noise. */
  texture?: THREE.Texture;
  /** Scroll speed in UV space, multiplied by system elapsed time. */
  scroll?: Vec2Tuple;
};

export type ParticlePreset = {
  name?: string;
  simulation?: SimulationMode;
  /**
   * Coordinate space used for particle simulation.
   * - `"local"` (default): particles are simulated in system local space and follow parent/object transforms.
   * - `"world"`: particles are simulated in world space after spawn and do not follow later emitter movement.
   */
  simulationSpace?: SimulationSpace;
  /** Optional explicit bounds. Primarily useful for GPU systems to enable stable frustum culling. */
  bounds?: ParticleBounds;
  maxParticles?: number;
  duration?: number;
  loop?: boolean;
  prewarm?: boolean;
  autoDispose?: boolean;
  callbacks?: ParticleLifecycleCallbacks;
  debug?: boolean | ParticleDebugOptions;

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
    acceleration?: Vec3Tuple;
    drag?: number;
    vortex?: {
      /** Center of rotation in simulation space. */
      center?: Vec3Tuple;
      /** Vortex axis direction. Default `[0, 1, 0]`. */
      axis?: Vec3Tuple;
      /** Tangential acceleration around the axis. */
      orbitalSpeed?: number;
      /** Inward acceleration toward the axis. */
      inward?: number;
      /** Axial acceleration along the axis. */
      upward?: number;
    };
    noise?: {
      strength?: number;
      frequency?: number;
      /** World-space advection speed for the noise field. */
      scroll?: Vec3Tuple;
      /** Number of FBM octaves (1-4 recommended). */
      octaves?: number;
      /** Frequency multiplier per octave. */
      lacunarity?: number;
      /** Amplitude multiplier per octave. */
      persistence?: number;
    };
  };

  /**
   * CPU backend only for now. Caps particle speed by normalized age.
   * Use a flat curve for constant caps: `[[0, 4], [1, 4]]`.
   */
  limitVelocityOverLifetime?: {
    /** Maximum speed curve sampled by normalized age (0..1). */
    speed?: Curve;
    /** Blend factor toward the capped velocity when over the limit. `1` = hard clamp. Default `1`. */
    dampen?: number;
  };

  /** CPU backend only. Ignored on GPU. */
  collision?: CpuCollision;
  /** CPU backend only. Child effect names to spawn from particle lifecycle events. */
  subEmitters?: {
    onBirth?: string;
    onDeath?: string;
    onCollision?: string;
  };

  velocityOverLifetime?: VelocityOverLifetime;

  /**
   * Tint by current speed `|velocity|` (simulation velocity only; excludes `velocityOverLifetime` offset).
   * Multiplies RGB after `start.color` and `overLifetime.color`. CPU and GPU.
   */
  colorBySpeed?: ColorBySpeed;

  /**
   * Size multiplier from current speed. Multiplies after `start.size` and `overLifetime.size`. CPU and GPU.
   */
  sizeBySpeed?: SizeBySpeed;

  /**
   * Drive spin rate from current speed (rad/s). When set, replaces the spawned `start.angularVelocity` each frame. CPU and GPU.
   */
  rotationBySpeed?: RotationBySpeed;

  overLifetime?: {
    size?: Curve;
    opacity?: Curve;
    color?: Gradient;
  };

  renderer?: {
    type?: RendererType;
    texture?: THREE.Texture;
    blendMode?: BlendMode;
    align?: AlignMode;
    /** Only used by `renderer.type: "stretchedBillboard"`. Multiplies elongation by particle speed. Default `0.35`. */
    stretchFactor?: number;
    /** Only used by `renderer.type: "stretchedBillboard"`. Maximum length scale relative to base size. Default `4`. */
    stretchMaxScale?: number;
    /**
     * CPU backend only. Order in which alive particles are written into the geometry buffer.
     * - `"none"`: slot order (cheapest).
     * - `"distance"`: back-to-front by world-space camera depth (default; correct for alpha blending).
     * - `"youngestFirst"`: youngest particles drawn last so they appear in front of older ones.
     * - `"oldestFirst"`: oldest particles drawn last so they appear in front of younger ones.
     * Ignored on the GPU backend.
     */
    sorting?: SortMode;
    depthWrite?: boolean;
    depthTest?: boolean;
    /** Enables depth-based edge fading when a scene depth texture is provided via `ParticleSystem.setSoftParticleDepthTexture(...)`. */
    softParticles?: boolean;
    /** Soft-particle fade strength multiplier. Higher values fade out faster near geometry intersections. Default `1.5`. */
    softness?: number;
    textureSheet?: {
      columns: number;
      rows: number;
      randomFrame?: boolean;
      frameOverLifetime?: boolean;
      randomStartFrame?: boolean;
    };
    /** Optional noise- or texture-driven dissolve of billboard alpha over lifetime. */
    dispersal?: ParticleRendererDispersal;
  };
};

export type ParticleSystemOptions = {
  renderer?: THREE.WebGLRenderer;
};

export type ParticleWorldPoolingOptions = {
  /** When set, excess inactive instances for an effect are disposed instead of pooled. Omit for no cap. */
  maxPerEffect?: number;
};

export type ParticleWorldOptions = {
  renderer?: THREE.WebGLRenderer;
  /**
   * When enabled, `ParticleWorld` returns completed systems to an inactive pool instead of disposing them.
   * Reuses GPU/CPU resources for the same registered effect name. See docs for renderer override rules.
   */
  pooling?: boolean | ParticleWorldPoolingOptions;
};

export type ParticleSpawnOptions = {
  position?: THREE.Vector3 | Vec3Tuple;
  rotation?: THREE.Euler;
  quaternion?: THREE.Quaternion;
  scale?: number;
  parent?: THREE.Object3D;
  autoPlay?: boolean;
  debug?: boolean | ParticleDebugOptions;
};

export type SoftParticleDepthTextureOptions = {
  /** Scene depth texture width in pixels. Optional if inferred from `depthTexture.image.width`. */
  width?: number;
  /** Scene depth texture height in pixels. Optional if inferred from `depthTexture.image.height`. */
  height?: number;
};

export type ParticleSnapshot = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  lifetime: number;
};

export type ParticleLifecycleCallbacks = {
  onStart?: (system: ParticleSystem) => void;
  onStop?: (system: ParticleSystem) => void;
  onComplete?: (system: ParticleSystem) => void;
  onParticleBirth?: (particle: ParticleSnapshot, system: ParticleSystem) => void;
  onParticleDeath?: (particle: ParticleSnapshot, system: ParticleSystem) => void;
  onParticleCollision?: (particle: ParticleSnapshot, system: ParticleSystem) => void;
};

type ParticleBackendOptions = {
  onParticleBirth?: (particle: Particle) => void;
  onParticleDeath?: (particle: Particle) => void;
  onParticleCollision?: (particle: Particle) => void;
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

type TextureSheetConfig = {
  columns: number;
  rows: number;
  totalFrames: number;
  frameOverLifetime: boolean;
  randomFrame: boolean;
};

interface ParticleBackend {
  readonly object: THREE.Object3D;
  readonly elapsed: number;
  readonly aliveCount: number;
  readonly isAlive: boolean;
  readonly isPlaying: boolean;
  readonly isComplete: boolean;
  readonly isDisposed: boolean;
  play(): void;
  pause(): void;
  stop(options?: { clear?: boolean }): void;
  restart(): void;
  emit(count: number): void;
  setSoftParticleDepthTexture(depthTexture: THREE.Texture | null, options?: SoftParticleDepthTextureOptions): void;
  update(dt: number, camera: THREE.Camera): void;
  dispose(options?: { disposeTexture?: boolean }): void;
}

const DEFAULT_EMITTER: EmitterShape = { type: "point" };
const DEFAULT_GIZMO_COLOR = "#78d7ff";

const tempColorA = new THREE.Color();
const tempColorB = new THREE.Color();
const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();
const tempVectorD = new THREE.Vector3();
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

function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smoothstep01(x - ix);
  const fy = smoothstep01(y - iy);
  const fz = smoothstep01(z - iz);

  const c000 = hash3(ix, iy, iz);
  const c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz);
  const c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1);
  const c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1);
  const c111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = THREE.MathUtils.lerp(c000, c100, fx);
  const x10 = THREE.MathUtils.lerp(c010, c110, fx);
  const x01 = THREE.MathUtils.lerp(c001, c101, fx);
  const x11 = THREE.MathUtils.lerp(c011, c111, fx);
  const y0 = THREE.MathUtils.lerp(x00, x10, fy);
  const y1 = THREE.MathUtils.lerp(x01, x11, fy);
  return THREE.MathUtils.lerp(y0, y1, fz);
}

function fbmNoise3(
  x: number,
  y: number,
  z: number,
  octaves: number,
  lacunarity: number,
  persistence: number
): number {
  let frequency = 1;
  let amplitude = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(x * frequency, y * frequency, z * frequency) * amplitude;
    norm += amplitude;
    frequency *= lacunarity;
    amplitude *= persistence;
  }
  return norm > 0 ? sum / norm : 0;
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

/** `t` in `[0, 1]` for sampling curves/gradients keyed 0..1 from scalar speed. */
function speedToParam(speed: number, speedRange: [number, number]): number {
  const lo = speedRange[0];
  const hi = speedRange[1];
  const span = hi - lo;
  if (Math.abs(span) < 1e-8) return 0;
  return THREE.MathUtils.clamp((speed - lo) / span, 0, 1);
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

function getTextureSheetConfig(preset: ParticlePreset): TextureSheetConfig | undefined {
  const sheet = preset.renderer?.textureSheet;
  if (!sheet) return undefined;

  const columns = Math.max(1, Math.floor(sheet.columns));
  const rows = Math.max(1, Math.floor(sheet.rows));
  const totalFrames = columns * rows;
  return {
    columns,
    rows,
    totalFrames,
    frameOverLifetime: sheet.frameOverLifetime ?? false,
    randomFrame: sheet.randomFrame ?? sheet.randomStartFrame ?? false,
  };
}

function resolveDebugOptions(debug: boolean | ParticleDebugOptions | undefined): Required<ParticleDebugOptions> {
  const options = typeof debug === "object" ? debug : {};
  const enabled = typeof debug === "boolean" ? debug : options.enabled ?? false;
  return {
    enabled,
    emitter: options.emitter ?? true,
    spawnDirection: options.spawnDirection ?? true,
    bounds: options.bounds ?? true,
    color: options.color ?? DEFAULT_GIZMO_COLOR,
    opacity: options.opacity ?? 0.85,
    segments: Math.max(8, Math.floor(options.segments ?? 48)),
  };
}

function addLine(points: THREE.Vector3[], a: THREE.Vector3, b: THREE.Vector3): void {
  points.push(a.clone(), b.clone());
}

function addCircle(points: THREE.Vector3[], radius: number, segments: number, plane: "xy" | "xz" | "yz", center = tempVectorA.set(0, 0, 0)): void {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0 = circlePoint(radius, a0, plane).add(center);
    const p1 = circlePoint(radius, a1, plane).add(center);
    addLine(points, p0, p1);
  }
}

function addArc(points: THREE.Vector3[], radius: number, segments: number, plane: "xy" | "yz"): void {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI;
    const a1 = ((i + 1) / segments) * Math.PI;
    const p0 = plane === "xy" ? new THREE.Vector3(Math.cos(a0) * radius, Math.sin(a0) * radius, 0) : new THREE.Vector3(0, Math.sin(a0) * radius, Math.cos(a0) * radius);
    const p1 = plane === "xy" ? new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius, 0) : new THREE.Vector3(0, Math.sin(a1) * radius, Math.cos(a1) * radius);
    addLine(points, p0, p1);
  }
}

function circlePoint(radius: number, angle: number, plane: "xy" | "xz" | "yz"): THREE.Vector3 {
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  if (plane === "xy") return new THREE.Vector3(x, y, 0);
  if (plane === "xz") return new THREE.Vector3(x, 0, y);
  return new THREE.Vector3(0, x, y);
}

function addArrow(points: THREE.Vector3[], from: THREE.Vector3, to: THREE.Vector3, headLength: number): void {
  addLine(points, from, to);
  const direction = tempVectorA.copy(to).sub(from).normalize();
  const right = tempVectorB.set(1, 0, 0);
  if (Math.abs(direction.dot(right)) > 0.95) right.set(0, 0, 1);
  const side = tempVectorC.copy(direction).cross(right).normalize().multiplyScalar(headLength * 0.45);
  const back = direction.multiplyScalar(-headLength);
  const headCenter = to.clone().add(back);
  addLine(points, to, headCenter.clone().add(side));
  addLine(points, to, headCenter.clone().sub(side));
}

function makeEmitterGizmo(
  shape: EmitterShape = DEFAULT_EMITTER,
  debug: boolean | ParticleDebugOptions | undefined,
  bounds?: ParticleBounds
): THREE.LineSegments {
  const options = resolveDebugOptions(debug);
  const points: THREE.Vector3[] = [];
  const segments = options.segments;

  if (options.emitter) {
    if (shape.type === "point") {
      const size = 0.18;
      addLine(points, new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0));
      addLine(points, new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0));
      addLine(points, new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size));
    } else if (shape.type === "sphere") {
      const radius = shape.radius ?? 1;
      addCircle(points, radius, segments, "xy");
      addCircle(points, radius, segments, "xz");
      addCircle(points, radius, segments, "yz");
    } else if (shape.type === "hemisphere") {
      const radius = shape.radius ?? 1;
      addCircle(points, radius, segments, "xz");
      addArc(points, radius, Math.floor(segments / 2), "xy");
      addArc(points, radius, Math.floor(segments / 2), "yz");
    } else if (shape.type === "cone") {
      const radius = shape.radius ?? 0.1;
      const length = shape.length ?? 1;
      const spread = Math.tan(THREE.MathUtils.degToRad(shape.angle ?? 25)) * length;
      const endRadius = Math.max(radius, spread);
      addCircle(points, radius, segments, "xz");
      addCircle(points, endRadius, segments, "xz", new THREE.Vector3(0, length, 0));
      const sideCount = 8;
      for (let i = 0; i < sideCount; i++) {
        const angle = (i / sideCount) * Math.PI * 2;
        addLine(points, circlePoint(radius, angle, "xz"), circlePoint(endRadius, angle, "xz").add(new THREE.Vector3(0, length, 0)));
      }
    } else if (shape.type === "box") {
      const [sx, sy, sz] = shape.size ?? [1, 1, 1];
      const x = sx * 0.5;
      const y = sy * 0.5;
      const z = sz * 0.5;
      const corners = [
        new THREE.Vector3(-x, -y, -z),
        new THREE.Vector3(x, -y, -z),
        new THREE.Vector3(x, -y, z),
        new THREE.Vector3(-x, -y, z),
        new THREE.Vector3(-x, y, -z),
        new THREE.Vector3(x, y, -z),
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(-x, y, z),
      ];
      const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const;
      for (const [a, b] of edges) addLine(points, corners[a], corners[b]);
    }
  }

  if (options.spawnDirection) {
    const length = shape.type === "cone" ? shape.length ?? 1 : shape.type === "box" ? Math.max(...(shape.size ?? [1, 1, 1])) * 0.55 : "radius" in shape ? (shape.radius ?? 1) * 1.25 : 0.45;
    addArrow(points, new THREE.Vector3(), new THREE.Vector3(0, Math.max(0.25, length), 0), Math.max(0.08, length * 0.12));
  }

  if (options.bounds && bounds) {
    const center = bounds.center ?? [0, 0, 0];
    const offset = new THREE.Vector3(center[0], center[1], center[2]);
    addCircle(points, bounds.radius, segments, "xy", offset);
    addCircle(points, bounds.radius, segments, "xz", offset);
    addCircle(points, bounds.radius, segments, "yz", offset);
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: options.color,
    transparent: true,
    opacity: options.opacity,
    depthTest: false,
  });
  const gizmo = new THREE.LineSegments(geometry, material);
  gizmo.frustumCulled = false;
  gizmo.renderOrder = 999;
  gizmo.visible = options.enabled;
  return gizmo;
}

/** Shared GLSL: noise + dissolve mask (must match GPU render fragment). */
const PARTICLE_DISPERSAL_GLSL = `
float dispersalHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float dispersalValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dispersalHash(i), dispersalHash(i + vec2(1.0, 0.0)), u.x),
    mix(dispersalHash(i + vec2(0.0, 1.0)), dispersalHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float dispersalMask(float noise, float progress, float edge) {
  float e = max(edge, 0.0001);
  float lo = progress * (1.0 + 2.0 * e) - e;
  float hi = lo + e;
  return smoothstep(lo, hi, noise);
}
`;

function makeParticleMaterial(options: NonNullable<ParticlePreset["renderer"]> = {}): THREE.ShaderMaterial {
  const softParticlesEnabled = options.softParticles ?? false;
  const dispersalEnabled = isRendererDispersalEnabled(options);
  const dispersal = options.dispersal;
  const dispersalMap = dispersal?.texture ?? null;
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: options.depthWrite ?? false,
    depthTest: options.depthTest ?? true,
    uniforms: {
      uTexture: { value: options.texture ?? makeDefaultParticleTexture() },
      uSceneDepth: { value: null },
      uSceneDepthSize: { value: new THREE.Vector2(1, 1) },
      uSoftParticles: { value: softParticlesEnabled ? 1 : 0 },
      uSoftness: { value: options.softness ?? 1.5 },
      uCameraNearFar: { value: new THREE.Vector2(0.1, 2000) },
      uCameraIsPerspective: { value: 1 },
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
      attribute vec4 particleColor;
      attribute vec2 particleDispersal;
      varying vec2 vUv;
      varying vec4 vColor;
      varying float vAgeT;
      varying float vDispersalSeed;
      void main() {
        vUv = uv;
        vColor = particleColor;
        vAgeT = particleDispersal.x;
        vDispersalSeed = particleDispersal.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
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
          vec2 dUv = vUv * uDispersalNoiseScale + vec2(vDispersalSeed * 17.413, vDispersalSeed * 63.291) + scroll;
          float n = uDispersalUseMap == 1 ? texture2D(uDispersalMap, dUv).r : dispersalValueNoise(dUv);
          float amount = texture2D(uDispersalAmountCurve, vec2(clamp(vAgeT, 0.0, 1.0), 0.5)).r;
          float m = dispersalMask(n, amount, uDispersalEdge);
          outColor.a *= mix(1.0, m, clamp(uDispersalStrength, 0.0, 1.0));
        }
        if (outColor.a < 0.001) discard;
        gl_FragColor = outColor;
      }
    `,
  });

  applyBlendMode(material, options.blendMode ?? "alpha");
  return material;
}

function isRendererDispersalEnabled(renderer: ParticlePreset["renderer"] | undefined): boolean {
  const d = renderer?.dispersal;
  if (!d) return false;
  return d.enabled !== false;
}

/** Normalized-age → dissolve amount (`0`..`1`). Without a curve, samples the identity ramp. */
function makeDispersalAmountCurveTexture(curve: Curve | undefined): THREE.DataTexture {
  const width = 256;
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const v = curve ? THREE.MathUtils.clamp(evaluateCurve(curve, t, t), 0, 1) : t;
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

let dispersalAmountCurvePlaceholder: THREE.DataTexture | undefined;
function getDispersalAmountCurvePlaceholder(): THREE.DataTexture {
  if (!dispersalAmountCurvePlaceholder) dispersalAmountCurvePlaceholder = makeDispersalAmountCurveTexture(undefined);
  return dispersalAmountCurvePlaceholder;
}

let dispersalWhitePlaceholder: THREE.DataTexture | undefined;
function getDispersalWhitePlaceholderTexture(): THREE.DataTexture {
  if (!dispersalWhitePlaceholder) {
    const d = new Uint8Array([255, 255, 255, 255]);
    dispersalWhitePlaceholder = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    dispersalWhitePlaceholder.needsUpdate = true;
    dispersalWhitePlaceholder.magFilter = THREE.LinearFilter;
    dispersalWhitePlaceholder.minFilter = THREE.LinearFilter;
    dispersalWhitePlaceholder.wrapS = THREE.RepeatWrapping;
    dispersalWhitePlaceholder.wrapT = THREE.RepeatWrapping;
  }
  return dispersalWhitePlaceholder;
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

/** 1×256 float ramp for arbitrary scalar curves (e.g. size or angular velocity vs normalized speed). */
function makeCurveFloatTexture(curve: Curve | undefined, fallback = 1): THREE.DataTexture {
  const width = 256;
  const data = new Float32Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const v = evaluateCurve(curve, t, fallback);
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 1;
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.FloatType);
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

function makeVectorCurveTexture(velocity: VelocityOverLifetime | undefined): THREE.DataTexture {
  const width = 256;
  const data = new Float32Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    data[i * 4 + 0] = evaluateCurve(velocity?.linear?.x, t, 0);
    data[i * 4 + 1] = evaluateCurve(velocity?.linear?.y, t, 0);
    data[i * 4 + 2] = evaluateCurve(velocity?.linear?.z, t, 0);
    data[i * 4 + 3] = 1;
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
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
    u.uCameraNearFar.value.set(camera.near, camera.far);
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
    particle.lifetime = Math.max(0.01, randomRange(start.lifetime ?? 1));
    particle.velocity.copy(sample.direction).multiplyScalar(randomRange(start.speed ?? 1)).add(randomVec3(start.velocity ?? [0, 0, 0]));
    particle.startSize = randomRange(start.size ?? 0.2);
    particle.startOpacity = randomRange(start.opacity ?? 1);
    particle.startColor.copy(randomColor(start.color ?? "#ffffff"));
    particle.rotation = randomRange(start.rotation ?? 0);
    particle.angularVelocity = randomRange(start.angularVelocity ?? 0);
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
        angularVel = evaluateCurve(rbs.angularVelocity, speedToParam(simSpeed, rbs.speedRange), 0);
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

class GPUParticleBackend implements ParticleBackend {
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
    this.lifetimeVelocityTexture.dispose();
    this.sizeBySpeedCurveTexture.dispose();
    this.colorBySpeedGradientTexture.dispose();
    this.rotationBySpeedCurveTexture.dispose();
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
    const e = this.object.matrixWorld.elements;
    u.uSystemWorldPosition.value.set(e[12], e[13], e[14]);
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
        uSystemWorldPosition: { value: new THREE.Vector3() },
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
        uniform vec3 uSystemWorldPosition;

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
            if (uSimulationSpace == 1) pos += uSystemWorldPosition;
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
            vec2 dUv = vUv * uDispersalNoiseScale + vec2(vDispersalSeed * 17.413, vDispersalSeed * 63.291) + scroll;
            float n = uDispersalUseMap == 1 ? texture2D(uDispersalMap, dUv).r : dispersalValueNoise(dUv);
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
    this.material.uniforms.uCameraNearFar.value.set(camera.near, camera.far);
    this.material.uniforms.uCameraIsPerspective.value = camera instanceof THREE.PerspectiveCamera ? 1 : 0;
    const udt = this.material.uniforms.uDispersalTime;
    if (udt) udt.value = this._elapsed;
  }
}

function shouldUseGpu(preset: ParticlePreset, options: ParticleSystemOptions): boolean {
  if (preset.gpu?.forceCpuFallback) return false;
  if (preset.collision) return false;
  if (preset.subEmitters) return false;
  if (preset.renderer?.type === "stretchedBillboard") return false;
  if (preset.simulation === "cpu") return false;
  if (preset.simulation === "gpu") return !!options.renderer;
  if (preset.simulation === "auto") return !!options.renderer && (preset.maxParticles ?? 0) >= 2048;
  return false;
}

export class ParticleSystem extends THREE.Object3D {
  readonly preset: ParticlePreset;
  readonly backendType: "cpu" | "gpu";
  private backend: ParticleBackend;
  private gizmo?: THREE.LineSegments;
  private completionNotified = false;

  constructor(preset: ParticlePreset = {}, options: ParticleSystemOptions = {}) {
    super();
    this.preset = preset;

    assertValidParticlePreset(preset, { renderer: options.renderer });

    const useGpu = shouldUseGpu(preset, options);
    this.backendType = useGpu ? "gpu" : "cpu";
    this.backend = useGpu
      ? new GPUParticleBackend(preset, options.renderer!)
      : new CPUParticleBackend(preset, {
          onParticleBirth: (particle) => this.notifyParticleBirth(particle),
          onParticleDeath: (particle) => this.notifyParticleDeath(particle),
          onParticleCollision: (particle) => this.notifyParticleCollision(particle),
        });
    (this as unknown as THREE.Object3D).add(this.backend.object);
    this.setDebug(preset.debug);
  }

  get elapsed(): number {
    return this.backend.elapsed;
  }

  get aliveCount(): number {
    return this.backend.aliveCount;
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
    const wasPlaying = this.backend.isPlaying;
    this.backend.play();
    this.completionNotified = false;
    if (!wasPlaying) this.preset.callbacks?.onStart?.(this);
    return this;
  }

  pause(): this {
    this.backend.pause();
    return this;
  }

  stop(options?: { clear?: boolean }): this {
    const wasActive = this.backend.isPlaying || this.backend.isAlive;
    this.backend.stop(options);
    this.completionNotified = this.backend.isComplete;
    if (wasActive) this.preset.callbacks?.onStop?.(this);
    return this;
  }

  restart(): this {
    this.backend.restart();
    this.completionNotified = false;
    this.preset.callbacks?.onStart?.(this);
    return this;
  }

  emit(count: number): this {
    this.backend.emit(count);
    return this;
  }

  setSoftParticleDepthTexture(depthTexture: THREE.Texture | null, options?: SoftParticleDepthTextureOptions): this {
    this.backend.setSoftParticleDepthTexture(depthTexture, options);
    return this;
  }

  setDebug(debug: boolean | ParticleDebugOptions | undefined): this {
    const options = resolveDebugOptions(debug);

    if (!options.enabled) {
      if (this.gizmo) this.gizmo.visible = false;
      return this;
    }

    if (this.gizmo) {
      this.gizmo.removeFromParent();
      this.gizmo.geometry.dispose();
      (this.gizmo.material as THREE.Material).dispose();
    }

    this.gizmo = makeEmitterGizmo(this.preset.emitter ?? DEFAULT_EMITTER, options, this.preset.bounds);
    (this as unknown as THREE.Object3D).add(this.gizmo);
    return this;
  }

  update(dt: number, camera: THREE.Camera): void {
    this.backend.update(dt, camera);
    if (this.backend.isComplete && !this.completionNotified) {
      this.completionNotified = true;
      this.preset.callbacks?.onComplete?.(this);
    }
  }

  dispose(options?: { disposeTexture?: boolean }): void {
    if (this.gizmo) {
      this.gizmo.geometry.dispose();
      (this.gizmo.material as THREE.Material).dispose();
      this.gizmo = undefined;
    }
    this.backend.dispose(options);
    (this as unknown as THREE.Object3D).removeFromParent();
  }

  private notifyParticleBirth(particle: Particle): void {
    this.preset.callbacks?.onParticleBirth?.(
      {
        position: particle.position.clone(),
        velocity: particle.velocity.clone(),
        age: particle.age,
        lifetime: particle.lifetime,
      },
      this
    );
  }

  private notifyParticleDeath(particle: Particle): void {
    this.preset.callbacks?.onParticleDeath?.(
      {
        position: particle.position.clone(),
        velocity: particle.velocity.clone(),
        age: particle.age,
        lifetime: particle.lifetime,
      },
      this
    );
  }

  private notifyParticleCollision(particle: Particle): void {
    this.preset.callbacks?.onParticleCollision?.(
      {
        position: particle.position.clone(),
        velocity: particle.velocity.clone(),
        age: particle.age,
        lifetime: particle.lifetime,
      },
      this
    );
  }
}

function configureSpawnedSystem(system: ParticleSystem, options: ParticleSpawnOptions): void {
  const systemObject = system as unknown as THREE.Object3D;
  systemObject.position.set(0, 0, 0);
  systemObject.rotation.set(0, 0, 0);
  systemObject.quaternion.identity();
  systemObject.scale.set(1, 1, 1);
  if (options.position) Array.isArray(options.position) ? systemObject.position.set(...options.position) : systemObject.position.copy(options.position);
  if (options.rotation) systemObject.rotation.copy(options.rotation);
  if (options.quaternion) systemObject.quaternion.copy(options.quaternion);
  if (typeof options.scale === "number") systemObject.scale.setScalar(options.scale);

  const parent = options.parent;
  if (parent) parent.add(systemObject);
  if (options.debug !== undefined) system.setDebug(options.debug);
  if (options.autoPlay ?? true) system.play();
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
    options: ParticleSpawnOptions & { renderer?: THREE.WebGLRenderer } = {}
  ): ParticleSystem {
    const preset = this.presets.get(name);
    if (!preset) throw new Error(`Unknown particle effect "${name}".`);

    const { renderer: spawnRenderer, ...rest } = options;
    const system = new ParticleSystem(preset, { renderer: spawnRenderer ?? this.renderer });
    configureSpawnedSystem(system, {
      ...rest,
      parent: rest.parent ?? this.defaultParent,
    });
    return system;
  }
}

export class ParticleWorld {
  readonly effects: ParticleEffectLibrary;
  readonly systems = new Set<ParticleSystem>();
  private readonly inactivePool = new Map<string, ParticleSystem[]>();
  /** Tracks systems spawned through this world for auto-dispose pooling. */
  private readonly systemSpawnMeta = new Map<ParticleSystem, { name: string; poolable: boolean; subEmitterDepth: number }>();
  debug: boolean | ParticleDebugOptions = false;
  private readonly maxSubEmitterDepth = 3;

  constructor(private parent: THREE.Object3D, presets: Record<string, ParticlePreset> = {}, private options: ParticleWorldOptions = {}) {
    this.effects = new ParticleEffectLibrary(presets, parent, options);
  }

  private isPoolingEnabled(): boolean {
    const p = this.options.pooling;
    if (p === undefined || p === false) return false;
    return true;
  }

  private getPoolMaxPerEffect(): number | undefined {
    const p = this.options.pooling;
    if (p === undefined || p === false || p === true) return undefined;
    return p.maxPerEffect;
  }

  private disposePoolForEffect(name: string): void {
    const stack = this.inactivePool.get(name);
    if (!stack) return;
    for (const s of stack) s.dispose();
    this.inactivePool.delete(name);
  }

  private tryReturnToPool(name: string, system: ParticleSystem): void {
    system.stop({ clear: true });
    (system as unknown as THREE.Object3D).removeFromParent();
    const max = this.getPoolMaxPerEffect();
    const stack = this.inactivePool.get(name) ?? [];
    if (max !== undefined && stack.length >= max) {
      system.dispose();
      return;
    }
    stack.push(system);
    this.inactivePool.set(name, stack);
  }

  private createManagedPreset(basePreset: ParticlePreset): ParticlePreset {
    const originalCallbacks = basePreset.callbacks;
    return {
      ...basePreset,
      callbacks: {
        ...originalCallbacks,
        onParticleDeath: (particle, system) => {
          originalCallbacks?.onParticleDeath?.(particle, system);
          this.handleSubEmitterDeath(particle, system);
        },
        onParticleBirth: (particle, system) => {
          originalCallbacks?.onParticleBirth?.(particle, system);
          this.handleSubEmitterBirth(particle, system);
        },
        onParticleCollision: (particle, system) => {
          originalCallbacks?.onParticleCollision?.(particle, system);
          this.handleSubEmitterCollision(particle, system);
        },
      },
    };
  }

  private createManagedSystem(preset: ParticlePreset, renderer?: THREE.WebGLRenderer): ParticleSystem {
    const managedPreset = this.createManagedPreset(preset);
    return new ParticleSystem(managedPreset, { renderer });
  }

  private handleSubEmitterDeath(particle: ParticleSnapshot, system: ParticleSystem): void {
    const meta = this.systemSpawnMeta.get(system);
    if (!meta) return;

    const targetName = system.preset.subEmitters?.onDeath;
    if (!targetName) return;
    if (!this.effects.get(targetName)) return;
    if (meta.subEmitterDepth >= this.maxSubEmitterDepth) return;

    const worldPosition = this.resolveParticleWorldPosition(particle, system);

    this.spawnInternal(
      targetName,
      {
        position: worldPosition,
        parent: this.parent,
      },
      meta.subEmitterDepth + 1
    );
  }

  private handleSubEmitterBirth(particle: ParticleSnapshot, system: ParticleSystem): void {
    const meta = this.systemSpawnMeta.get(system);
    if (!meta) return;

    const targetName = system.preset.subEmitters?.onBirth;
    if (!targetName) return;
    if (!this.effects.get(targetName)) return;
    if (meta.subEmitterDepth >= this.maxSubEmitterDepth) return;

    const worldPosition = this.resolveParticleWorldPosition(particle, system);

    this.spawnInternal(
      targetName,
      {
        position: worldPosition,
        parent: this.parent,
      },
      meta.subEmitterDepth + 1
    );
  }

  private handleSubEmitterCollision(particle: ParticleSnapshot, system: ParticleSystem): void {
    const meta = this.systemSpawnMeta.get(system);
    if (!meta) return;

    const targetName = system.preset.subEmitters?.onCollision;
    if (!targetName) return;
    if (!this.effects.get(targetName)) return;
    if (meta.subEmitterDepth >= this.maxSubEmitterDepth) return;

    const worldPosition = this.resolveParticleWorldPosition(particle, system);

    this.spawnInternal(
      targetName,
      {
        position: worldPosition,
        parent: this.parent,
      },
      meta.subEmitterDepth + 1
    );
  }

  private spawnInternal(name: string, options: Parameters<ParticleEffectLibrary["spawn"]>[1] = {}, subEmitterDepth: number): ParticleSystem {
    const debug = options.debug ?? this.debug;
    const merged: ParticleSpawnOptions & { renderer?: THREE.WebGLRenderer } = {
      parent: this.parent,
      renderer: this.options.renderer,
      ...options,
      ...(debug ? { debug } : {}),
    };

    const preset = this.effects.get(name);
    if (!preset) throw new Error(`Unknown particle effect "${name}".`);

    const spawnRenderer = options.renderer ?? this.options.renderer;
    const poolable = this.isPoolingEnabled() && spawnRenderer === this.options.renderer;

    let system: ParticleSystem | undefined;
    if (poolable) {
      const stack = this.inactivePool.get(name);
      if (stack && stack.length > 0) system = stack.pop();
    }

    if (!system) {
      system = this.createManagedSystem(preset, spawnRenderer);
    }

    const { renderer: _spawnRenderer, ...configureOpts } = merged;
    configureSpawnedSystem(system, configureOpts);

    this.systems.add(system);
    this.systemSpawnMeta.set(system, { name, poolable, subEmitterDepth });
    return system;
  }

  private resolveParticleWorldPosition(particle: ParticleSnapshot, system: ParticleSystem): THREE.Vector3 {
    const worldPosition = particle.position.clone();
    if ((system.preset.simulationSpace ?? "local") === "world") return worldPosition;
    (system as unknown as THREE.Object3D).localToWorld(worldPosition);
    return worldPosition;
  }

  register(name: string, preset: ParticlePreset): this {
    this.effects.register(name, preset);
    this.disposePoolForEffect(name);
    return this;
  }

  preload(name: string, count: number): this {
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`ParticleWorld.preload("${name}", count): count must be an integer >= 1.`);
    }
    if (!this.isPoolingEnabled()) {
      throw new Error('ParticleWorld.preload requires pooling to be enabled via ParticleWorldOptions.pooling.');
    }

    const preset = this.effects.get(name);
    if (!preset) throw new Error(`Unknown particle effect "${name}".`);

    const stack = this.inactivePool.get(name) ?? [];
    const max = this.getPoolMaxPerEffect();
    const remainingCapacity = max === undefined ? count : Math.max(0, Math.min(count, max - stack.length));
    if (remainingCapacity <= 0) {
      this.inactivePool.set(name, stack);
      return this;
    }

    for (let i = 0; i < remainingCapacity; i++) {
      stack.push(this.createManagedSystem(preset, this.options.renderer));
    }
    this.inactivePool.set(name, stack);
    return this;
  }

  spawn(name: string, options: Parameters<ParticleEffectLibrary["spawn"]>[1] = {}): ParticleSystem {
    return this.spawnInternal(name, options, 0);
  }

  setDebug(debug: boolean | ParticleDebugOptions): this {
    this.debug = debug;
    for (const system of this.systems) system.setDebug(debug);
    return this;
  }

  update(dt: number, camera: THREE.Camera): void {
    for (const system of [...this.systems]) {
      if (system.isDisposed) {
        this.systems.delete(system);
        this.systemSpawnMeta.delete(system);
        continue;
      }
      system.update(dt, camera);
      if (!(system.preset.autoDispose ?? true) || !system.isComplete) continue;

      const meta = this.systemSpawnMeta.get(system);
      this.systems.delete(system);
      this.systemSpawnMeta.delete(system);

      if (meta?.poolable && this.isPoolingEnabled()) {
        this.tryReturnToPool(meta.name, system);
      } else {
        system.dispose();
      }
    }
  }

  clear(): void {
    for (const system of this.systems) system.dispose();
    this.systems.clear();
    this.systemSpawnMeta.clear();
    for (const stack of this.inactivePool.values()) for (const s of stack) s.dispose();
    this.inactivePool.clear();
  }
}

export { assertValidParticlePreset, collectParticlePresetIssues, presetWouldUseGpu } from "./particle-preset-validation";
export type { ParticlePresetValidationContext, ParticlePresetValidationResult } from "./particle-preset-validation";
