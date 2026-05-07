# Public API Reference

All public exports come from the package root (`@tontonius/wisp`), backed by `src/index.ts` at build time.

```ts
export * from "./particles";
export * from "./camera";
export * from "./wisp";
```

Wisp currently exposes three core areas:

- camera effects (`Wisp`, `WispCamera`, `CameraEffectsSystem`, `CameraShakeController`)
- motion effects (`WispMotion`, `MotionEffectsSystem`, `MotionController`)
- particles (`ParticleManager`, `ParticleEffectLibrary`, `ParticleSystem`, and particle types/utilities)
- starter content (`createStarterTextures`, `createStarterPresets`, `createStarterKit`, `starterBillboardUrls`)

## IntelliSense Contract

Public symbols are documented in source with JSDoc/TSDoc so generated declaration files carry parameter help into consumer projects.

- Hover/signature help in editors should surface defaults, units, and behavior caveats for exported APIs.
- Runtime behavior remains source-of-truth; docs here and in type hovers are kept aligned.
- Internal/private members are intentionally not documented as part of this contract.

## Exported Classes

### `Wisp`

```ts
class Wisp
```

High-level facade for modular effects systems. It exposes `wisp.camera` and `wisp.particles`.

Constructor:

```ts
new Wisp(camera: THREE.Camera, options?: CameraEffectsOptions)
new Wisp(options: WispOptions)
```

Fields:

| Field | Type | Description |
| --- | --- | --- |
| `camera` | `WispCamera` | Camera effects namespace (`shake`, `update`, `reset`, tuning). |
| `motion` | `WispMotion \| undefined` | Motion effects namespace when `WispOptions.motion` is provided. |
| `particles` | `WispParticles \| undefined` | Particle effects namespace when `WispOptions.scene` and `WispOptions.particles` are provided. |

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `update(dt, camera?)` | `void` | Updates all active facade modules (`camera`, `particles`). |
| `dispose()` | `void` | Resets camera effects state and releases internal references. |

### `WispMotion`

```ts
class WispMotion
```

Facade wrapper around `MotionEffectsSystem` under `wisp.motion`.

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `motion(target)` | `MotionHandle` | Returns fluent per-object motion handle. |
| `pop(target, options?)` | `this` | Adds a one-shot scale pop effect. |
| `squash(target, options?)` | `this` | Adds a one-shot squash/stretch effect. |
| `recoil(target, direction, options?)` | `this` | Adds recoil position/rotation impulse. |
| `hover(target, options?)` | `this` | Enables looping hover offset. |
| `breathe(target, options?)` | `this` | Enables looping breathe scale modulation. |
| `leanByVelocity(target, source, options?)` | `this` | Adds velocity-response lean effect. |
| `release(target)` | `void` | Removes controller and restores baseline transform. |
| `update(dt)` | `void` | Advances motion simulation. Usually called via `wisp.update(dt)`. |
| `clear()` | `void` | Restores all controlled objects and removes controllers. |

Getters:

| Getter | Type | Description |
| --- | --- | --- |
| `size` | `number` | Number of active motion controllers. |

### `WispParticles`

```ts
class WispParticles
```

Facade wrapper around the internal particle manager under `wisp.particles`.

Fields:

| Field | Type | Description |
| --- | --- | --- |
| `systems` | `ReadonlySet<ParticleSystem>` | Live particle systems managed by this facade module. |
| `debug` | `boolean \| ParticleDebugOptions` | Current debug setting. |

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `register(name, preset)` | `this` | Register or replace a named particle preset. |
| `spawn(name, options?)` | `ParticleSystem` | Spawn a particle effect by name. |
| `preload(name, count)` | `this` | Fill inactive pool for an effect (requires pooling). |
| `setDebug(debug)` | `this` | Set debug behavior for currently active and future systems. |
| `update(dt, camera)` | `void` | Advance particle simulation. Usually called via `wisp.update(dt)`. |
| `clear()` | `void` | Dispose all active systems and clear inactive pool. |

### `WispCamera`

```ts
class WispCamera
```

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `shake(impulse)` | `this` | Adds trauma impulse (`number` or `{ trauma }`). |
| `configureShake(options?)` | `this` | Replaces camera shake tuning at runtime. |
| `update(dt)` | `void` | Advances shake simulation and applies offsets. |
| `reset()` | `this` | Clears trauma and restores unshaken camera transform. |

Getters:

| Getter | Type | Description |
| --- | --- | --- |
| `trauma` | `number` | Current trauma value in `[0, 1]`. |

### `CameraShakeController`

```ts
class CameraShakeController
```

Low-level shake controller for direct camera integration.

Constructor:

```ts
new CameraShakeController(camera: THREE.Camera, options?: CameraShakeOptions)
```

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `shake(impulse)` | `void` | Adds trauma impulse (`number` or `{ trauma }`). |
| `addTrauma(amount)` | `void` | Adds trauma directly; value is clamped to `[0, 1]`. |
| `configure(options?)` | `void` | Replaces shake tuning. |
| `update(dt)` | `void` | Applies coherent noise-based shake with linear trauma decay. |
| `reset()` | `void` | Restores baseline camera transform and clears trauma. |
| `dispose()` | `void` | Alias for cleanup/reset behavior. |

### `CameraEffectsSystem`

```ts
class CameraEffectsSystem
```

Camera module wrapper used by the `Wisp` facade.

Constructor:

```ts
new CameraEffectsSystem(camera: THREE.Camera, options?: CameraShakeOptions)
```

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `shake(impulse)` | `this` | Adds a trauma impulse. |
| `configureShake(options?)` | `this` | Replaces shake tuning. |
| `update(dt)` | `void` | Updates camera shake. |
| `reset()` | `this` | Restores baseline transform and clears trauma. |
| `dispose()` | `void` | Resets camera shake state. |

Getters:

| Getter | Type | Description |
| --- | --- | --- |
| `trauma` | `number` | Current trauma value in `[0, 1]`. |

### `MotionEffectsSystem`

```ts
class MotionEffectsSystem
```

Low-level additive transform manager for object motion effects.

Constructor:

```ts
new MotionEffectsSystem(options?: MotionControllerOptions)
```

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `motion(target)` | `MotionHandle` | Creates/reuses controller and returns fluent handle. |
| `release(target)` | `void` | Restores target baseline transform and removes controller. |
| `update(dt)` | `void` | Updates all controllers by `dt` seconds. |
| `clear()` | `void` | Resets all controlled targets and clears controllers. |

Getters:

| Getter | Type | Description |
| --- | --- | --- |
| `size` | `number` | Number of active controllers. |

### `ParticleSystem`

```ts
class ParticleSystem extends THREE.Object3D
```

A single live particle effect. It owns either a CPU backend or a GPU backend.

Constructor:

```ts
new ParticleSystem(preset?: ParticlePreset, options?: ParticleSystemOptions)
```

Before backends are created, the preset is validated with [`assertValidParticlePreset`](preset-validation.md) (see [Preset validation](preset-validation.md)). Invalid presets throw; recoverable situations (for example `simulation: "gpu"` without a renderer) emit a warning and still fall back to CPU as documented.

Readonly fields:

| Field | Type | Description |
| --- | --- | --- |
| `preset` | `ParticlePreset` | Preset used to construct the system. |
| `backendType` | `"cpu" | "gpu"` | Actual backend selected after fallback and `auto` resolution. |

Getters:

| Getter | Type | Description |
| --- | --- | --- |
| `elapsed` | `number` | System emission time in seconds. |
| `aliveCount` | `number` | CPU: live particle count. GPU: conservative approximate value. |
| `isAlive` | `boolean` | Whether particles may still be alive. |
| `isPlaying` | `boolean` | Whether emission is currently advancing. |
| `isComplete` | `boolean` | Whether emission is complete and no particles remain alive. |
| `isDisposed` | `boolean` | Whether the system has been disposed. |

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `play()` | `this` | Starts or resumes emission. Calls `callbacks.onStart` when transitioning from stopped/paused to playing. |
| `pause()` | `this` | Pauses emission. Existing particles continue to update when `update()` is called. |
| `stop(options?)` | `this` | Stops emission, resets elapsed time and burst state. Clears particles by default. |
| `restart()` | `this` | Stops, clears, starts again, and calls `callbacks.onStart`. |
| `emit(count)` | `this` | Immediately queues or spawns `count` particles. |
| `setDebug(debug)` | `this` | Enables, updates, or hides emitter gizmos. |
| `setSoftParticleDepthTexture(depthTexture, options?)` | `this` | Sets or clears (`null`) the scene depth texture used by opt-in soft-particle fading. |
| `update(dt, camera)` | `void` | Advances simulation and updates render geometry/uniforms. |
| `dispose(options?)` | `void` | Disposes geometry, material, backend resources, and removes the system from its parent. |

`stop` options:

```ts
system.stop({ clear?: boolean });
```

- `clear` defaults to `true`.
- `clear: false` stops future emission while allowing existing particles to age out.

`dispose` options:

```ts
system.dispose({ disposeTexture?: boolean });
```

- `disposeTexture` defaults to `false`.
- Set it to `true` only when the system owns the texture and no other system or material uses it.

`setSoftParticleDepthTexture` options:

```ts
system.setSoftParticleDepthTexture(depthTexture, {
  width?: number,
  height?: number,
});
```

- `depthTexture` is a scene depth texture from your render target/composer pipeline.
- Pass `null` to disable soft-particle depth fading at runtime.
- `width`/`height` are optional when the texture image already exposes dimensions.

### `ParticleEffectLibrary`

A registry of named presets. It can spawn `ParticleSystem` instances, optionally adding them to a default parent.

Constructor:

```ts
new ParticleEffectLibrary(
  presets?: Record<string, ParticlePreset>,
  defaultParent?: THREE.Object3D,
  options?: ParticleManagerOptions
)
```

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `register(name, preset)` | `this` | Stores a preset under `name`. The stored copy receives `name`. |
| `get(name)` | `ParticlePreset | undefined` | Returns a registered preset. |
| `spawn(name, options?)` | `ParticleSystem` | Creates, transforms, parents, optionally debugs, and optionally plays a system. |

Spawn options (`ParticleSpawnOptions` plus optional `renderer`):

```ts
ParticleSpawnOptions & { renderer?: THREE.WebGLRenderer }
```

Fields match `ParticleSpawnOptions` in the exported types table, plus:

- `renderer` overrides the library renderer for this spawn.

Behavior:

- Unknown effect names throw `Error("Unknown particle effect ...")`.
- `position` accepts a `THREE.Vector3` or `[x, y, z]`.
- `scale` is uniform and uses `Object3D.scale.setScalar`.
- `autoPlay` defaults to `true`.
- `renderer` overrides the library renderer for this spawn.
- `debug` overrides preset debug settings for this spawn.
- Before applying options, spawn resets the system’s local `position`, `rotation`, `quaternion`, and `scale` to identity defaults so reused instances do not keep the previous transform for omitted fields.

### `ParticleManager`

A higher-level manager for named effects and live systems.

Constructor:

```ts
new ParticleManager(
  parent: THREE.Object3D,
  presets?: Record<string, ParticlePreset>,
  options?: ParticleManagerOptions
)
```

Fields:

| Field | Type | Description |
| --- | --- | --- |
| `effects` | `ParticleEffectLibrary` | The named effect registry. |
| `systems` | `Set<ParticleSystem>` | Live systems spawned through `ParticleManager.spawn` (active only; inactive pooled instances are not in this set). |
| `debug` | `boolean | ParticleDebugOptions` | Default debug setting applied by `spawn`. |

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `register(name, preset)` | `this` | Registers a named preset in `effects` and disposes any inactive pooled systems for that `name` so the pool cannot return instances built from a replaced preset. |
| `preload(name, count)` | `this` | Creates up to `count` inactive pooled instances for an effect name (respects `pooling.maxPerEffect`). Requires pooling to be enabled. |
| `spawn(name, options?)` | `ParticleSystem` | Creates or reuses a system, applies spawn options and world defaults, tracks it in `systems`, and returns it. |
| `setDebug(debug)` | `this` | Stores a world debug default and applies it to currently tracked systems. |
| `update(dt, camera)` | `void` | Updates all tracked systems, auto-disposes completed one-shots or returns them to the inactive pool when pooling is enabled. |
| `clear()` | `void` | Disposes every tracked system, disposes all inactive pooled systems, and empties internal pool storage. |

`ParticleManagerOptions`:

```ts
{
  renderer?: THREE.WebGLRenderer;
  pooling?: boolean | { maxPerEffect?: number };
}
```

- `pooling: true` enables inactive pooling per registered effect name with no cap on how many completed systems are retained (watch memory in effects with huge GPU targets).
- `pooling: { maxPerEffect: n }` caps the inactive queue per effect; additional completed systems are disposed like the non-pooling path.
- Pooling is off when `pooling` is omitted or `false`.

Pooling rules:

- Pooling is used by `ParticleManager.spawn` (consume/recycle) and `ParticleManager.preload` (proactive fill). Calling `world.effects.spawn` always allocates a new system and does not use the manager pool.
- A completed system is poolable only if it was spawned with the same effective WebGL renderer as `options.renderer` on the world constructor: `(spawnOptions.renderer ?? worldOptions.renderer) === worldOptions.renderer`. If a spawn passes a different `renderer` override, that instance is always fully disposed on completion (GPU render targets are tied to a specific renderer).
- On completion with `autoDispose` true and pooling enabled for a poolable instance, the world calls `stop({ clear: true })`, removes the object from the scene graph, and pushes it onto an inactive stack for that effect name instead of calling `dispose()`.
- Systems that were manually `dispose()`d are dropped from `systems` on the next `update` without being pooled.
- `preload(name, count)` requires pooling (`pooling: true` or `{ maxPerEffect }`) and throws when pooling is off.

Auto-disposal:

- During `update`, systems with `system.preset.autoDispose ?? true` and `system.isComplete` are removed from `systems`. When pooling applies, they are reset and parked in the inactive pool; otherwise they are disposed.
- Set `autoDispose: false` for loops, persistent ambient effects, or systems you want to stop/dispose manually.

## Preset validation

Exported functions (see [Preset validation](preset-validation.md)):

| Export | Role |
| --- | --- |
| `collectParticlePresetIssues(preset, context?)` | Returns `{ errors, warnings }` without throwing. |
| `assertValidParticlePreset(preset, context?)` | Logs warnings, throws if any errors. |
| `presetWouldUseGpu(preset, renderer?)` | Whether the preset would select the GPU path for the given renderer. |

## Exported Types

| Type | Shape |
| --- | --- |
| `Range` | `number | [number, number]` |
| `Vec3Tuple` | `[number, number, number]` |
| `Vec3Range` | `Vec3Tuple | [Vec3Tuple, Vec3Tuple]` |
| `BlendMode` | `"alpha" | "additive" | "multiply"` |
| `AlignMode` | `"camera" | "velocity"` |
| `SimulationMode` | `"cpu" | "gpu" | "auto"` |
| `Curve` | `Array<[time: number, value: number]>` |
| `Gradient` | `Array<[time: number, color: THREE.ColorRepresentation]>` |
| `VelocityOverLifetime` | Linear x/y/z curve module. |
| `EmitterShape` | Point, sphere, hemisphere, cone, or box emitter config. |
| `ParticleDebugOptions` | Emitter gizmo options. |
| `ParticlePreset` | Full effect description. |
| `ParticleSystemOptions` | `{ renderer?: THREE.WebGLRenderer }` |
| `ParticleManagerOptions` | `{ renderer?: THREE.WebGLRenderer; pooling?: boolean \| { maxPerEffect?: number } }` |
| `ParticlePoolingOptions` | `{ maxPerEffect?: number }` — cap inactive instances per effect when `pooling` is an object. |
| `ParticleSpawnOptions` | Transform, parent, `autoPlay`, and `debug` fields shared by `ParticleEffectLibrary.spawn` / `ParticleManager.spawn` (manager merge also applies default `parent` and `debug`). |
| `SoftParticleDepthTextureOptions` | `{ width?: number; height?: number }` — optional depth texture dimensions for soft-particle sampling. |
| `ParticleSnapshot` | CPU particle-death snapshot. |
| `ParticleLifecycleCallbacks` | Lifecycle callback object. |
| `ParticlePresetValidationContext` | `{ renderer?: THREE.WebGLRenderer }` — optional context for validation. |
| `ParticlePresetValidationResult` | `{ errors: string[]; warnings: string[] }` — output of `collectParticlePresetIssues`. |
| `CameraShakeImpulse` | `number | { trauma: number }` |
| `CameraShakeMode` | `"rotationOnly" | "rotationAndTranslation"` |
| `CameraShakeOptions` | Camera shake tuning object (decay, power curve, coherent noise, max offsets). |
| `CameraEffectsOptions` | `{ shake?: CameraShakeOptions }` |
| `MotionEffectPhase` | `"persistent" | "response" | "impulse" | "oneshot"` |
| `MotionOffset` | Optional channel offsets `{ position?, rotation?, scale? }`. |
| `MotionControllerOptions` | `{ maxDt?: number }` |
| `MotionPopOptions` | One-shot pop tuning `{ duration?, strength? }` |
| `MotionSquashOptions` | One-shot squash tuning `{ duration?, amount? }` |
| `MotionRecoilOptions` | Recoil tuning `{ duration?, distance?, rotation? }` |
| `MotionHoverOptions` | Hover tuning `{ amplitude?, frequency? }` |
| `MotionBreatheOptions` | Breathe tuning `{ amplitude?, frequency? }` |
| `MotionLeanByVelocityOptions` | Lean tuning `{ maxAngle?, response? }` |
| `MotionVectorSource` | `() => THREE.Vector3 | [number, number, number]` |
| `WispMotionOptions` | Motion module options (currently `MotionControllerOptions`). |
| `WispParticleOptions` | `ParticleManagerOptions & { presets?: Record<string, ParticlePreset> }` |
| `WispOptions` | `{ scene?: THREE.Object3D; camera: THREE.Camera; cameraEffects?: CameraEffectsOptions; motion?: WispMotionOptions; particles?: WispParticleOptions }` |
| `StarterTexturePack` | `{ softDisc; hardDisc; spark; smokePuffsSheet4x4 }` as `THREE.Texture` values. |
| `StarterEffectName` | `"explosion" | "muzzleFlash" | "smokePuff" | "hitSparks" | "magicBurst" | "runSmoke" | "jumpSmokeRing"` |
| `StarterKit` | `{ textures: StarterTexturePack; presets: Record<StarterEffectName, ParticlePreset> }` |

See the dedicated reference pages for exact option semantics.

## Starter Kit Helpers

Use these helpers when you want a zero-setup starter pack:

```ts
import { createStarterKit } from "@tontonius/wisp";

const { presets } = createStarterKit();
```

Then pass those presets directly into `Wisp`:

```ts
const wisp = new Wisp({
  scene,
  camera,
  particles: { renderer, presets },
});

wisp.particles?.spawn("explosion");
```

See [Starter Kit](starter-kit.md) for details.

Use `Wisp`/`wisp.particles` as the primary public runtime surface for effect management.

