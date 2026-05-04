# Public API Reference

All public exports come from `src/index.ts`, which re-exports `src/particles.ts`.

```ts
export * from "./particles";
```

## Exported Classes

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

### `ParticleEffectLibrary`

A registry of named presets. It can spawn `ParticleSystem` instances, optionally adding them to a default parent.

Constructor:

```ts
new ParticleEffectLibrary(
  presets?: Record<string, ParticlePreset>,
  defaultParent?: THREE.Object3D,
  options?: ParticleWorldOptions
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

### `ParticleWorld`

A higher-level manager for named effects and live systems.

Constructor:

```ts
new ParticleWorld(
  parent: THREE.Object3D,
  presets?: Record<string, ParticlePreset>,
  options?: ParticleWorldOptions
)
```

Fields:

| Field | Type | Description |
| --- | --- | --- |
| `effects` | `ParticleEffectLibrary` | The named effect registry. |
| `systems` | `Set<ParticleSystem>` | Live systems spawned through `ParticleWorld.spawn` (active only; inactive pooled instances are not in this set). |
| `debug` | `boolean | ParticleDebugOptions` | Default debug setting applied by `spawn`. |

Methods:

| Method | Returns | Description |
| --- | --- | --- |
| `register(name, preset)` | `this` | Registers a named preset in `effects` and disposes any inactive pooled systems for that `name` so the pool cannot return instances built from a replaced preset. |
| `spawn(name, options?)` | `ParticleSystem` | Creates or reuses a system, applies spawn options and world defaults, tracks it in `systems`, and returns it. |
| `setDebug(debug)` | `this` | Stores a world debug default and applies it to currently tracked systems. |
| `update(dt, camera)` | `void` | Updates all tracked systems, auto-disposes completed one-shots or returns them to the inactive pool when pooling is enabled. |
| `clear()` | `void` | Disposes every tracked system, disposes all inactive pooled systems, and empties internal pool storage. |

`ParticleWorldOptions`:

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

- Only `ParticleWorld.spawn` participates. Calling `world.effects.spawn` always allocates a new system and does not use the world pool.
- A completed system is poolable only if it was spawned with the same effective WebGL renderer as `options.renderer` on the world constructor: `(spawnOptions.renderer ?? worldOptions.renderer) === worldOptions.renderer`. If a spawn passes a different `renderer` override, that instance is always fully disposed on completion (GPU render targets are tied to a specific renderer).
- On completion with `autoDispose` true and pooling enabled for a poolable instance, the world calls `stop({ clear: true })`, removes the object from the scene graph, and pushes it onto an inactive stack for that effect name instead of calling `dispose()`.
- Systems that were manually `dispose()`d are dropped from `systems` on the next `update` without being pooled.

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
| `ParticleWorldOptions` | `{ renderer?: THREE.WebGLRenderer; pooling?: boolean \| { maxPerEffect?: number } }` |
| `ParticleWorldPoolingOptions` | `{ maxPerEffect?: number }` — cap inactive instances per effect when `pooling` is an object. |
| `ParticleSpawnOptions` | Transform, parent, `autoPlay`, and `debug` fields shared by `ParticleEffectLibrary.spawn` / `ParticleWorld.spawn` (world merge also applies default `parent` and `debug`). |
| `ParticleSnapshot` | CPU particle-death snapshot. |
| `ParticleLifecycleCallbacks` | Lifecycle callback object. |
| `ParticlePresetValidationContext` | `{ renderer?: THREE.WebGLRenderer }` — optional context for validation. |
| `ParticlePresetValidationResult` | `{ errors: string[]; warnings: string[] }` — output of `collectParticlePresetIssues`. |

See the dedicated reference pages for exact option semantics.

