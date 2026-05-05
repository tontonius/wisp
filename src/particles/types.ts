import * as THREE from "three";
import type { ParticleSystem } from "./system";

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
export type TextureSheetAnimationMode = "static" | "randomStart" | "overLifetime" | "randomStartOverLifetime";
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

/** Add a fraction of emitter motion to spawned particle velocity. CPU-only for now. */
export type InheritVelocity = {
  factor: Range;
};

/** Remap emitter speed at spawn into a particle lifetime range. CPU-only for now. */
export type LifetimeByEmitterSpeed = {
  speedRange: SpeedRemapRange;
  lifetimeRange: Range;
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

  /** CPU backend only for now. Adds `emitterVelocity * factor` to spawned velocity. */
  inheritVelocity?: InheritVelocity;

  /**
   * CPU backend only for now. Overrides spawn lifetime by remapping emitter speed into `lifetimeRange`.
   * Sampled once at spawn.
   */
  lifetimeByEmitterSpeed?: LifetimeByEmitterSpeed;

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
      animationMode?: TextureSheetAnimationMode;
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

export type ParticleBackendOptions = {
  onParticleBirth?: (particle: Particle) => void;
  onParticleDeath?: (particle: Particle) => void;
  onParticleCollision?: (particle: Particle) => void;
};

export type Particle = {
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

export type SpawnRequest = {
  start: number;
  count: number;
  seed: number;
};

export type TextureSheetConfig = {
  columns: number;
  rows: number;
  totalFrames: number;
  frameOverLifetime: boolean;
  randomFrame: boolean;
};

export interface ParticleBackend {
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
