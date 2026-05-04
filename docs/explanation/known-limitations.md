# Known Limitations

This system is useful, but it is still an MVP.

## No Transparent Particle Sorting

Particles are not sorted back-to-front.

Implications:

- Additive blending works well.
- Alpha smoke can be acceptable.
- Dense overlapping alpha particles may render in visually incorrect order.

## No Collisions

Particles do not collide with scene geometry.

For future collision work, CPU is the natural first backend.

## No Sub-Emitters

Particles cannot spawn child effects on birth, collision, or death.

CPU `onParticleDeath` can be used manually for simple death-triggered effects, but built-in sub-emitters do not exist yet.

## No Mesh Emitters

Supported emitter shapes are:

- Point.
- Sphere.
- Hemisphere.
- Cone.
- Box.

Mesh surface or volume emission is not implemented.

## No Trails Or Ribbons

Particles are rendered as billboards only.

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

