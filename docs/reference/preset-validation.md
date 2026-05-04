# Preset Validation

The library validates `ParticlePreset` values when a [`ParticleSystem`](api.md) is constructed. Invalid presets throw before CPU or GPU backends allocate geometry or render targets.

## When Validation Runs

- **`new ParticleSystem(preset, options)`** — always runs [`assertValidParticlePreset`](#assertvalidparticlepreset).
- **`ParticleEffectLibrary.register`** — does **not** validate by itself; invalid presets are still rejected the first time a system is created from that preset (for example on `spawn`).

Use [`collectParticlePresetIssues`](#collectparticlepresetissues) in editors or tooling to surface issues without constructing a system.

## API

### `collectParticlePresetIssues`

```ts
function collectParticlePresetIssues(
  preset: ParticlePreset,
  context?: ParticlePresetValidationContext
): ParticlePresetValidationResult;
```

Returns `{ errors: string[]; warnings: string[] }` with stable messages. Paths use dotted keys (for example `overLifetime.size`, `emission.bursts[0].time`).

### `assertValidParticlePreset`

```ts
function assertValidParticlePreset(
  preset: ParticlePreset,
  context?: ParticlePresetValidationContext
): void;
```

Runs `collectParticlePresetIssues`, logs each **warning** once with `console.warn` and a `[ParticlePreset]` prefix, then **throws** an `Error` if there are any errors. The error message lists all errors.

### `presetWouldUseGpu`

```ts
function presetWouldUseGpu(
  preset: ParticlePreset,
  renderer: THREE.WebGLRenderer | undefined
): boolean;
```

Matches the same rules as internal GPU selection (`simulation`, `auto` threshold, `gpu.forceCpuFallback`, and CPU-only modules like `collision` / `subEmitters` disabling GPU). Used for warning logic (for example `onParticleDeath` on GPU).

### `ParticlePresetValidationContext`

```ts
type ParticlePresetValidationContext = {
  renderer?: THREE.WebGLRenderer;
};
```

Pass the same renderer you pass into `ParticleSystemOptions` so validation can warn about `simulation: "gpu"` without a renderer and about GPU + `onParticleDeath`.

## Errors (throw)

| Area | Rule |
| --- | --- |
| `maxParticles` | If set, must be an integer `>= 1`. |
| `duration` | If set, must be finite and `>= 0`. |
| `emitter.type` | If `emitter` is set, `type` must be `point`, `sphere`, `hemisphere`, `cone`, or `box`. |
| `renderer.textureSheet` | If set, `columns` and `rows` must be integers `>= 1` (invalid values are no longer silently clamped for authoring). |
| `gpu.textureSize` | If set, integer `>= 1` and `textureSize² >= maxParticles` (using `maxParticles ?? 1024`). |
| `gpu.maxSpawnPerFrame` | If set, integer `>= 1`. |
| `renderer.type` | If set, must be `"billboard"` or `"stretchedBillboard"`. `simulation: "gpu"` + `"stretchedBillboard"` is invalid (CPU-only). |
| `renderer.stretchFactor` | If set, must be finite and `>= 0`. |
| `renderer.stretchMaxScale` | If set, must be finite and `>= 1`. |
| `renderer.softParticles` | If set, must be a boolean. |
| `renderer.softness` | If set, must be finite and `> 0`. |
| `renderer.sorting` | If set, must be `"none"`, `"distance"`, `"youngestFirst"`, or `"oldestFirst"`. |
| `renderer.dispersal` | If set, must be an object; `enabled` must be a boolean when set; `strength` in `[0, 1]`; `noiseScale` finite and `> 0`; `edgeSoftness` finite and `> 0`; `scroll` a finite `[x, y]` tuple; `amount` a valid `Curve` when set. |
| `limitVelocityOverLifetime.speed` | If set, must be a valid `Curve` (finite keyframe times/values, non-decreasing times). |
| `limitVelocityOverLifetime.dampen` | If set, must be a finite number in `[0, 1]`. |
| Curves | `overLifetime.size`, `overLifetime.opacity`, and each defined `velocityOverLifetime.linear.{x,y,z}` keyframe must have finite `time` and `value`; times must be **non-decreasing**. Empty or one-point curves are allowed. |
| Gradients | `overLifetime.color` keyframes: finite time, non-decreasing times. |
| `start.*` ranges | For each set `start` range field, values must be finite scalars or finite tuple endpoints. |
| `start.lifetime` | Upper bound of the resolved range must be `> 0`. |
| `forces.vortex` | When set: `center`/`axis` must be finite vec3 tuples; `orbitalSpeed`, `inward`, and `upward` must be finite numbers. |
| `forces.noise` | `strength`/`frequency` must be finite (`strength >= 0`, `frequency >= 0`); `scroll` must be a finite vec3; `octaves` integer in `[1,4]`; `lacunarity >= 1`; `persistence` in `(0,1]`. |
| `colorBySpeed` | When set: object with finite `speedRange` `[min, max]` where `max >= min`, and non-empty `gradient` passing gradient rules. |
| `sizeBySpeed` | When set: object with valid `speedRange`, and non-empty `curve` passing curve rules. |
| `rotationBySpeed` | When set: object with valid `speedRange`, and non-empty `angularVelocity` curve passing curve rules. |
| `emission.bursts` | Each burst: finite `time >= 0`, valid `count` range, optional `probability` in `[0, 1]`. |
| `emission.rateOverTime` | If set, must be a finite scalar or finite tuple. |
| `collision` | If set with `simulation: "gpu"`, invalid (CPU-only). Otherwise `collision.type` must be `"plane"`, `"sphere"`, or `"box"` with primitive-specific finite fields (`plane.y`, `sphere.center`/`radius`, `box.center`/`size`) and optional `bounce` / `dampening` finite and `>= 0`. |
| `subEmitters` | If set with `simulation: "gpu"`, invalid (CPU-only). When set, must be an object and `subEmitters.onBirth` / `subEmitters.onDeath` / `subEmitters.onCollision` (if provided) must be non-empty string effect names. |

## Warnings (no throw)

| Condition | Message intent |
| --- | --- |
| `simulation: "gpu"` and no `renderer` in context | Same situation as before: CPU fallback; you are reminded to pass a renderer. |
| Resolved GPU path and `callbacks.onParticleBirth` set | Birth callbacks are CPU-only; they will not run on GPU. |
| Resolved GPU path and `callbacks.onParticleDeath` set | Death callbacks are CPU-only; they will not run on GPU. |
| Resolved GPU path and `callbacks.onParticleCollision` set | Collision callbacks are CPU-only; they will not run on GPU. |
| Resolved GPU path and `subEmitters.onBirth` set | Built-in sub-emitters are CPU-only; they will not run on GPU. |
| Resolved GPU path and `subEmitters.onDeath` set | Built-in sub-emitters are CPU-only; they will not run on GPU. |
| Resolved GPU path and `subEmitters.onCollision` set | Built-in sub-emitters are CPU-only; they will not run on GPU. |
| `simulation: "auto"`, `collision` set, renderer present, and `maxParticles >= 2048` | Auto would pick GPU at that capacity, but collision forces CPU. |
| Resolved GPU path and `renderer.sorting` set to anything other than `"none"` | Sorting is CPU-only; the GPU backend ignores it. |
| Resolved GPU path and `limitVelocityOverLifetime.speed` set | Limit-velocity-over-lifetime is CPU-only for now; the GPU backend ignores it. |

## See Also

- [ParticlePreset](particle-preset.md)
- [Types And Value Shapes](types-and-value-shapes.md) (curve and gradient time ordering)
- [Public API](api.md)
