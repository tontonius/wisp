# Known Limitations

This system is useful, but it is still an MVP.

## GPU Particles Are Not Sorted

The CPU backend sorts alive particles each frame (default `renderer.sorting: "distance"`, back-to-front). The GPU backend renders particles unsorted and ignores `renderer.sorting`.

Implications for GPU systems:

- Additive blending works well.
- Alpha smoke can be acceptable with `depthWrite: false`.
- Dense overlapping alpha particles may render in visually incorrect order.

For sorted alpha effects, prefer CPU simulation. See [Renderer reference: Sorting](../reference/renderer.md#sorting).

## Collisions Are CPU-Only And Planar

The CPU backend supports an optional infinite **horizontal plane** (`collision.type: "plane"`) in system local space. It is not arbitrary mesh or scene geometry, and the GPU backend does not simulate it.

For richer collision work (primitives, raycasts), CPU remains the intended path; see [CPU backend](../reference/cpu-backend.md#collision-plane).

## Sub-Emitters Are CPU-Only (for now)

Built-in sub-emitters currently support only:

- `subEmitters.onBirth` on CPU presets.
- `subEmitters.onDeath` on CPU presets.
- `subEmitters.onCollision` on CPU presets.
- Named child effects resolved through `ParticleWorld`.

Not yet implemented:

- Any GPU sub-emitter trigger path.

## No Mesh Emitters

Supported emitter shapes are:

- Point.
- Sphere.
- Hemisphere.
- Cone.
- Box.

Mesh surface or volume emission is not implemented.

## No Trails Or Ribbons

Particles are currently rendered as billboards (including stretched billboards), but not as continuous trails/ribbons.

## GPU Readback Is Avoided

The GPU backend does not read particle state back to the CPU.

Implications:

- No exact GPU `aliveCount`.
- No GPU `onParticleDeath`.
- Conservative GPU completion checks.

## Limited Velocity-Over-Lifetime Scope

Currently implemented:

- Linear X/Y/Z curves.

Not yet implemented:

- Local/world space toggle.
- Orbital velocity.
- Radial velocity.
- Offset center.
- Speed modifier.

## Preset Mutation Does Not Update GPU Lookup Textures

GPU curve and gradient textures are built when a GPU backend is constructed.

If you mutate `preset.overLifetime` or `preset.velocityOverLifetime` after spawning, the live GPU system does not rebuild those textures.

Dispose and respawn to apply changed curves.

## Object Pooling Is Opt-In On `ParticleWorld`

By default, completed `autoDispose` systems are fully disposed. You can enable inactive pooling with `ParticleWorldOptions.pooling` so completed systems are reset and reused for the same registered effect name.

`ParticleEffectLibrary` spawns are never pooled. Replacing a preset via `ParticleWorld.register` disposes inactive pooled instances for that name only; already-active systems still use the preset object they were constructed with until they finish.

