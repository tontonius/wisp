# CPU Versus GPU Design

The CPU and GPU backends intentionally overlap but are not identical in capability.

## CPU Philosophy

The CPU backend is precise and inspectable.

It can:

- Know exactly how many particles are alive.
- Fire `onParticleDeath`.
- Store particle state in ordinary objects.
- Use optional [`collision`](../reference/cpu-backend.md#collision-plane--sphere--box) (CPU-only primitives: `plane`, `sphere`, `box`).
- Integrate more gameplay-aware behavior later.

Its cost is that it updates particle state and billboard geometry on the CPU.

## GPU Philosophy

The GPU backend is high-volume and visual.

It can:

- Simulate thousands of particles.
- Keep particle state on the GPU.
- Avoid per-particle CPU work.
- Render with static geometry.

Its cost is that CPU readback is avoided. That means exact live counts and particle-death callbacks are intentionally unavailable.

## Shared Authoring

Both backends support the main preset model:

- Emitters.
- Continuous emission.
- Bursts.
- Start values.
- Forces.
- Velocity over lifetime.
- Size/opacity/color over lifetime.
- Texture sheets.
- Billboard rendering.

The implementation differs, but the authoring shape should stay familiar.

## `auto` Mode

`simulation: "auto"` is deliberately simple:

```txt
renderer exists and maxParticles >= 2048 => GPU
otherwise => CPU
```

If `collision` is set, **CPU** is always chosen (collision is not implemented on GPU).

This avoids surprising GPU choices for small effects where CPU is often more useful.

## Practical Split

Use CPU for:

- Muzzle flash.
- Hit spark.
- Bullet impact.
- Pickup sparkle.
- Small explosion.
- Effects that may later trigger gameplay events.

Use GPU for:

- Rain.
- Snow.
- Magic storm.
- Dust motes.
- Fireflies.
- Large aura fields.

