# ParticlePreset Reference

`ParticlePreset` is the central authoring object. It describes emission, spawn ranges, simulation backend, forces, lifetime curves, rendering, debug gizmos, and callbacks.

Invalid values are rejected when a [`ParticleSystem`](api.md) is constructed; see [Preset validation](preset-validation.md) for rules, warnings, and helper functions (`collectParticlePresetIssues`, `assertValidParticlePreset`).

```ts
type ParticlePreset = {
  name?: string;
  simulation?: SimulationMode;
  simulationSpace?: "local" | "world";
  bounds?: { center?: [number, number, number]; radius: number };
  maxParticles?: number;
  duration?: number;
  loop?: boolean;
  prewarm?: boolean;
  autoDispose?: boolean;
  callbacks?: ParticleLifecycleCallbacks;
  debug?: boolean | ParticleDebugOptions;
  gpu?: { textureSize?: number; maxSpawnPerFrame?: number; forceCpuFallback?: boolean };
  emitter?: EmitterShape;
  emission?: { rateOverTime?: Range; bursts?: Array<{ time: number; count: Range; probability?: number }> };
  start?: { ... };
  forces?: { ... };
  limitVelocityOverLifetime?: { speed?: Curve; dampen?: number };
  collision?: CpuCollision;
  subEmitters?: { onBirth?: string; onDeath?: string; onCollision?: string };
  velocityOverLifetime?: VelocityOverLifetime;
  colorBySpeed?: ColorBySpeed;
  sizeBySpeed?: SizeBySpeed;
  rotationBySpeed?: RotationBySpeed;
  inheritVelocity?: InheritVelocity;
  lifetimeByEmitterSpeed?: LifetimeByEmitterSpeed;
  overLifetime?: { ... };
  renderer?: { ... };
};
```

`CpuCollision` is exported from the package entry and matches the [collision primitives](cpu-backend.md#collision-plane--sphere--box) section on the CPU backend page.

## Top-Level Fields

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | Set by library registration | Human-readable or registry name. |
| `simulation` | `"cpu" | "gpu" | "auto"` | CPU unless `auto` or `gpu` selects GPU | Backend preference. |
| `simulationSpace` | `"local" | "world"` | `"local"` | Coordinate space for spawn/update integration. `"world"` keeps particles in world space after spawn. |
| `bounds` | `{ center?: Vec3Tuple; radius: number }` | `undefined` | Optional explicit bounds (mainly for GPU culling). Enables frustum culling with a fixed bounding sphere. |
| `maxParticles` | `number` | CPU: `256`, GPU: `1024` | Maximum live particle capacity. |
| `duration` | `number` | `1` | Emission duration in seconds. |
| `loop` | `boolean` | `false` | Whether emission restarts after `duration`. |
| `prewarm` | `boolean` | `false` | Whether to simulate one duration before first render. |
| `autoDispose` | `boolean` | `true` through `ParticleManager` | Whether `ParticleManager.update` disposes complete systems. |
| `callbacks` | `ParticleLifecycleCallbacks` | `undefined` | Lifecycle hooks. |
| `debug` | `boolean | ParticleDebugOptions` | `false` | Emitter gizmo settings. |
| `gpu` | Object | `undefined` | GPU backend options. |
| `emitter` | `EmitterShape` | `{ type: "point" }` | Spawn shape and direction. |
| `emission` | Object | No emission | Continuous rate and/or scheduled bursts. |
| `start` | Object | Individual defaults | Values sampled when each particle spawns. |
| `forces` | Object | No force | Constant acceleration, drag, optional point attractor, vortex column, and procedural noise; see [Forces](forces.md). |
| `limitVelocityOverLifetime` | Object | `undefined` | Speed cap module by normalized age. |
| `collision` | `CpuCollision` | `undefined` | CPU-only primitive collision (`plane`, `sphere`, or `box`) in local space; see [CPU backend](cpu-backend.md#collision-plane--sphere--box). |
| `subEmitters` | `{ onBirth?: string; onDeath?: string; onCollision?: string }` | `undefined` | CPU-only child effect hooks. `onBirth` spawns on CPU particle spawn, `onDeath` on particle death, and `onCollision` on primitive collision (when spawned through a `ParticleManager`). |
| `velocityOverLifetime` | `VelocityOverLifetime` | No lifetime velocity | Per-age linear velocity channel. |
| `colorBySpeed` | `ColorBySpeed` | `undefined` | RGB tint from simulation speed magnitude; see [Speed-driven modules](speed-driven.md). |
| `sizeBySpeed` | `SizeBySpeed` | `undefined` | Size multiplier from simulation speed magnitude; see [Speed-driven modules](speed-driven.md). |
| `rotationBySpeed` | `RotationBySpeed` | `undefined` | Angular velocity from simulation speed magnitude; see [Speed-driven modules](speed-driven.md). |
| `inheritVelocity` | `InheritVelocity` | `undefined` | CPU-only spawn velocity inheritance from emitter motion. |
| `lifetimeByEmitterSpeed` | `LifetimeByEmitterSpeed` | `undefined` | CPU-only spawn lifetime remap from emitter speed. |
| `overLifetime` | Object | Multipliers/color default to neutral values | Size, opacity, and color curves. |
| `renderer` | Object | Default soft particle material | Type, texture, blend, alignment, depth, stretch settings, and texture sheet settings. |

`EmitterShape` supports `point`, `sphere`, `hemisphere`, `disc`, `cone`, and `box`. See [Emitters reference](emitters.md) for field-level details.

## Simulation Selection

```ts
simulation?: "cpu" | "gpu" | "auto";
```

Selection rules:

- `simulation: "cpu"` always uses CPU.
- `simulation: "gpu"` uses GPU only if a compatible renderer is available.
- `simulation: "gpu"` without a renderer logs a warning and falls back to CPU.
- `simulation: "auto"` uses GPU when a renderer is available and `maxParticles >= 2048`.
- `gpu.backend: "auto"` picks the renderer-native GPU backend (`"webgl"` for `WebGLRenderer`, `"webgpu"` for `WebGPURenderer`).
- `gpu.backend: "webgl"` requires `WebGLRenderer`.
- `gpu.backend: "webgpu"` is accepted as an experimental selection. In authoritative mode it renders TSL billboards with compute-updated motion through a narrow motion readback bridge and CPU lifecycle bookkeeping.
- Omitted `simulation` currently uses CPU.
- `gpu.forceCpuFallback: true` forces CPU.
- `collision` set on the preset forces CPU (GPU does not implement collision).
- `subEmitters` set on the preset forces CPU (GPU does not implement built-in sub-emitters).

```ts
gpu?: {
  backend?: "auto" | "webgl" | "webgpu";
  textureSize?: number;
  maxSpawnPerFrame?: number;
  forceCpuFallback?: boolean;
}
```

## Simulation Space

```ts
simulationSpace?: "local" | "world";
```

- `"local"` (default): particles simulate in the `ParticleSystem` local space and follow parent/system transforms after spawn.
- `"world"`: particles simulate in world space after spawn and do not follow later system movement.
- `collision` primitives are evaluated in the configured simulation space.

## Capacity And Duration

```ts
maxParticles?: number;
duration?: number;
loop?: boolean;
prewarm?: boolean;
autoDispose?: boolean;
```

`maxParticles` controls storage capacity. When CPU capacity is full, additional spawns are skipped. The GPU backend cycles through slots with a spawn cursor.

`duration` controls emission time, not particle lifetime. Particles can live beyond duration.

`loop` resets elapsed emission time after duration and replays bursts.

`prewarm` simulates one duration before the visible start. This is useful for looping ambience such as fire, rain, snow, or aura effects.

`autoDispose` is used by `ParticleManager`, not by standalone `ParticleSystem`. One-shots default to auto-disposal when managed by a manager.

## Bounds

```ts
bounds?: {
  center?: [number, number, number];
  radius: number;
};
```

- Primarily useful for GPU systems.
- When set, GPU rendering uses this fixed bounding sphere for frustum culling.
- `radius` must be greater than `0`.
- When omitted, GPU systems stay unculled (`frustumCulled = false`) to avoid accidental pop-out.
- If bounds are too small, the whole effect can disappear abruptly when the sphere exits the camera frustum.

## GPU Options

```ts
gpu?: {
  textureSize?: number;
  maxSpawnPerFrame?: number;
  forceCpuFallback?: boolean;
};
```

| Field | Default | Description |
| --- | --- | --- |
| `textureSize` | `ceil(sqrt(maxParticles))` | Width and height of GPU state textures. Capacity is `textureSize * textureSize`. |
| `maxSpawnPerFrame` | `maxParticles` | Maximum number of particles queued by one `emit(count)` call. |
| `forceCpuFallback` | `false` | Forces CPU even if simulation asks for GPU. |

Use `textureSize` only when you need explicit render-target dimensions. Usually `maxParticles` is enough.

## Limit Velocity Over Lifetime

```ts
limitVelocityOverLifetime?: {
  speed?: Curve;
  dampen?: number;
}
```

- Supported by CPU and WebGPU. The WebGL GPU backend does not currently apply this module.
- `speed` is a max-speed curve sampled by normalized age (`0..1`).
- `dampen` is blend strength toward the capped velocity (`0..1`, default `1`).
- For a constant cap, use a flat curve such as `[[0, 4], [1, 4]]`.

## Emitter Motion Modules

```ts
inheritVelocity?: {
  factor: number | [number, number];
};

lifetimeByEmitterSpeed?: {
  speedRange: [number, number];
  lifetimeRange: number | [number, number];
};
```

- CPU-only in the current release.
- `inheritVelocity.factor` adds `emitterVelocity * factor` to each spawned particle.
- `lifetimeByEmitterSpeed` samples emitter speed at spawn time, maps it through `speedRange`, then linearly remaps into `lifetimeRange`.
- `lifetimeByEmitterSpeed` overrides `start.lifetime` when set.

## Renderer Options

```ts
renderer?: {
  type?: "billboard" | "stretchedBillboard";
  align?: "camera" | "velocity";
  intensity?: number;
  sorting?: "none" | "distance" | "youngestFirst" | "oldestFirst";
  stretchFactor?: number;
  stretchMaxScale?: number;
  softParticles?: boolean;
  softness?: number;
  // texture, blendMode, depthWrite, depthTest, textureSheet...
};
```

- `type` defaults to `"billboard"`.
- `type: "stretchedBillboard"` stretches quads along velocity on CPU and the experimental WebGPU backend. Other GPU backends fall back to CPU for this renderer type.
- `sorting` is CPU-only and defaults to `"distance"` (back-to-front by world-space camera depth). See [Renderer reference: Sorting](renderer.md#sorting).
- `intensity` scales particle RGB contribution (default `1`, must be `> 0` when set). This is useful for tuning additive/HDR glow without rewriting color gradients.
- `stretchFactor` controls speed-to-length scaling (default `0.35`).
- `stretchMaxScale` clamps elongation (default `4`).
- `softParticles` enables depth-fade at geometry intersections when you provide a scene depth texture through `system.setSoftParticleDepthTexture(...)`.
- `softness` controls fade strength (default `1.5`, must be `> 0` when set).

## Preset Registration

When registered through `ParticleEffectLibrary.register` or `ParticleManager.register`, the stored preset gets a copied `name` field:

```ts
library.register("smokePuff", preset);
library.get("smokePuff")?.name; // "smokePuff"
```

The original object is not mutated by registration.

## Full Example

```ts
const fire: ParticlePreset = {
  simulation: "gpu",
  maxParticles: 260,
  duration: 2,
  loop: true,
  prewarm: true,
  autoDispose: false,
  gpu: { maxSpawnPerFrame: 512 },
  emitter: { type: "cone", radius: 0.18, angle: 20, length: 1.4 },
  emission: { rateOverTime: 115 },
  start: {
    lifetime: [0.45, 1.05],
    speed: [0.55, 1.8],
    size: [0.12, 0.42],
    color: ["#fff4ad", "#ff6a22"],
    opacity: [0.5, 0.95],
    velocity: [[-0.18, 0.8, -0.18], [0.18, 2.15, 0.18]],
    rotation: [0, 360],
    angularVelocity: [-138, 138],
  },
  forces: {
    acceleration: [0, 1.15, 0],
    drag: 1.4,
    noise: { strength: 0.42, frequency: 7.5 },
  },
  velocityOverLifetime: {
    linear: { y: [[0, 0.4], [1, -0.15]] },
  },
  overLifetime: {
    size: [[0, 0.35], [0.3, 1], [1, 0.12]],
    opacity: [[0, 0], [0.08, 1], [0.7, 0.65], [1, 0]],
    color: [[0, "#fff8c8"], [0.35, "#ff9f1c"], [0.72, "#e53e1b"], [1, "#2b1209"]],
  },
  renderer: {
    blendMode: "additive",
    intensity: 1.6,
    depthWrite: false,
  },
};
```
