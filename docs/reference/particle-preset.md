# ParticlePreset Reference

`ParticlePreset` is the central authoring object. It describes emission, spawn ranges, simulation backend, forces, lifetime curves, rendering, debug gizmos, and callbacks.

Invalid values are rejected when a [`ParticleSystem`](api.md) is constructed; see [Preset validation](preset-validation.md) for rules, warnings, and helper functions (`collectParticlePresetIssues`, `assertValidParticlePreset`).

```ts
type ParticlePreset = {
  name?: string;
  simulation?: SimulationMode;
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
  collision?: CpuCollision;
  subEmitters?: { onBirth?: string; onDeath?: string; onCollision?: string };
  velocityOverLifetime?: VelocityOverLifetime;
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
| `maxParticles` | `number` | CPU: `256`, GPU: `1024` | Maximum live particle capacity. |
| `duration` | `number` | `1` | Emission duration in seconds. |
| `loop` | `boolean` | `false` | Whether emission restarts after `duration`. |
| `prewarm` | `boolean` | `false` | Whether to simulate one duration before first render. |
| `autoDispose` | `boolean` | `true` through `ParticleWorld` | Whether `ParticleWorld.update` disposes complete systems. |
| `callbacks` | `ParticleLifecycleCallbacks` | `undefined` | Lifecycle hooks. |
| `debug` | `boolean | ParticleDebugOptions` | `false` | Emitter gizmo settings. |
| `gpu` | Object | `undefined` | GPU backend options. |
| `emitter` | `EmitterShape` | `{ type: "point" }` | Spawn shape and direction. |
| `emission` | Object | No emission | Continuous rate and/or scheduled bursts. |
| `start` | Object | Individual defaults | Values sampled when each particle spawns. |
| `forces` | Object | No force | Constant acceleration, drag, and procedural noise. |
| `collision` | `CpuCollision` | `undefined` | CPU-only primitive collision (`plane`, `sphere`, or `box`) in local space; see [CPU backend](cpu-backend.md#collision-plane--sphere--box). |
| `subEmitters` | `{ onBirth?: string; onDeath?: string; onCollision?: string }` | `undefined` | CPU-only child effect hooks. `onBirth` spawns on CPU particle spawn, `onDeath` on particle death, and `onCollision` on primitive collision (when spawned through `ParticleWorld`). |
| `velocityOverLifetime` | `VelocityOverLifetime` | No lifetime velocity | Per-age linear velocity channel. |
| `overLifetime` | Object | Multipliers/color default to neutral values | Size, opacity, and color curves. |
| `renderer` | Object | Default soft particle material | Type, texture, blend, alignment, depth, stretch settings, and texture sheet settings. |

## Simulation Selection

```ts
simulation?: "cpu" | "gpu" | "auto";
```

Selection rules:

- `simulation: "cpu"` always uses CPU.
- `simulation: "gpu"` uses GPU only if a `THREE.WebGLRenderer` is available.
- `simulation: "gpu"` without a renderer logs a warning and falls back to CPU.
- `simulation: "auto"` uses GPU when a renderer is available and `maxParticles >= 2048`.
- Omitted `simulation` currently uses CPU.
- `gpu.forceCpuFallback: true` forces CPU.
- `collision` set on the preset forces CPU (GPU does not implement collision).
- `subEmitters` set on the preset forces CPU (GPU does not implement built-in sub-emitters).

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

`autoDispose` is used by `ParticleWorld`, not by standalone `ParticleSystem`. One-shots default to auto-disposal when managed by a world.

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

## Renderer Options

```ts
renderer?: {
  type?: "billboard" | "stretchedBillboard";
  align?: "camera" | "velocity";
  sorting?: "none" | "distance" | "youngestFirst" | "oldestFirst";
  stretchFactor?: number;
  stretchMaxScale?: number;
  // texture, blendMode, depthWrite, depthTest, textureSheet...
};
```

- `type` defaults to `"billboard"`.
- `type: "stretchedBillboard"` is CPU-only and stretches quads along velocity.
- `sorting` is CPU-only and defaults to `"distance"` (back-to-front by world-space camera depth). See [Renderer reference: Sorting](renderer.md#sorting).
- `stretchFactor` controls speed-to-length scaling (default `0.35`).
- `stretchMaxScale` clamps elongation (default `4`).

## Preset Registration

When registered through `ParticleEffectLibrary.register` or `ParticleWorld.register`, the stored preset gets a copied `name` field:

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
    rotation: [0, Math.PI * 2],
    angularVelocity: [-2.4, 2.4],
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
    depthWrite: false,
  },
};
```

