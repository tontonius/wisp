# CPU Backend Reference

The CPU backend stores each particle as JavaScript objects and updates geometry buffers every frame.

## Selection

CPU is used when:

- `simulation` is omitted.
- `simulation: "cpu"`.
- `simulation: "gpu"` is requested without a renderer.
- `simulation: "auto"` does not meet GPU criteria.
- `gpu.forceCpuFallback` is true.
- `collision` is set (CPU-only; GPU selection is skipped even for `simulation: "auto"` with high `maxParticles`).

## Defaults

| Field | Default |
| --- | --- |
| `maxParticles` | `256` |
| `duration` | `1` |
| `loop` | `false` |

## Particle State

Each CPU particle stores:

- `alive`.
- `position`.
- `velocity`.
- `age`.
- `lifetime`.
- `startSize`.
- `startOpacity`.
- `startColor`.
- `rotation`.
- `angularVelocity`.
- `randomSeed`.
- `startFrame`.

## Spawn Behavior

On spawn:

1. Find the first dead particle slot.
2. Sample emitter position and direction.
3. Sample start values.
4. Compute velocity:

```ts
velocity = emitterDirection * start.speed + start.velocity
```

If no dead slot exists, the spawn is skipped.

## Update Behavior

Per live particle:

1. Increase age.
2. Kill particle if age exceeds lifetime.
3. Apply constant acceleration.
4. Apply procedural noise.
5. Apply drag.
6. Evaluate velocity over lifetime.
7. Integrate position.
8. If `collision.type` is `"plane"`, resolve penetration against that plane (bounce, tangential dampening, or `killOnCollision`).
9. If `subEmitters.onCollision` is set and the system is managed by `ParticleWorld`, spawn that named effect at collision positions.
10. If `subEmitters.onDeath` is set and the system is managed by `ParticleWorld`, spawn that named effect at particle death positions.
11. Integrate rotation.

During spawn, if `subEmitters.onBirth` is set and the system is managed by `ParticleWorld`, that named child effect is spawned at each CPU particle birth position.

## Collision (plane)

```ts
collision?: {
  type: "plane";
  y?: number;
  bounce?: number;
  dampening?: number;
  killOnCollision?: boolean;
};
```

| Field | Default | Description |
| --- | --- | --- |
| `y` | `0` | Height of the infinite `xz` plane along **local Y** (same space as particle positions and the emitter). |
| `bounce` | `0.4` | Restitution on Y: after a hit from below the plane with downward `velocity.y`, outgoing `velocity.y` is `-bounce * velocity_y`. |
| `dampening` | `1` | After resolving a hit, `velocity.x` and `velocity.z` are multiplied by this factor. |
| `killOnCollision` | `false` | When true, penetrating the plane kills the particle and fires `onParticleDeath` instead of bouncing. |

The plane normal is **+Y**. Particles with `position.y` below the plane after integration are corrected. Spawning with the effect origin on the ground and `y: 0` matches a world floor at the spawn height.

GPU presets must not set `collision`; validation throws if `simulation: "gpu"` and `collision` are both set.

## Sub-emitters (onBirth / onDeath / onCollision)

```ts
subEmitters?: {
  onBirth?: string;
  onDeath?: string;
  onCollision?: string;
};
```

- CPU-only.
- `onBirth`, `onDeath`, and `onCollision` are named effects looked up in `ParticleWorld.effects`.
- Trigger source:
  - `onBirth`: when a CPU particle is spawned.
  - `onDeath`: every CPU particle death (lifetime expiry or `killOnCollision`).
  - `onCollision`: when a CPU particle penetrates the collision plane.
- Spawn location:
  - `onBirth`: spawned particle position in world space.
  - `onDeath`: particle death position in world space.
  - `onCollision`: collision-resolved position in world space.
- Triggering requires systems spawned through `ParticleWorld` (standalone `ParticleSystem` does not resolve named child effects).
- GPU presets must not set `subEmitters`; validation rejects `simulation: "gpu"` with `subEmitters`.

## Geometry Behavior

The CPU backend uses:

- One `THREE.BufferGeometry`.
- Six vertices per particle.
- `position`, `uv`, and `particleColor` attributes.

Every update:

- Live particles write quad vertices.
- `setDrawRange` limits rendering to live quads.
- Buffer attributes are marked for update.
- Bounding sphere is recomputed when particles are alive.

## Strengths

Use CPU for:

- Small effects.
- Gameplay-adjacent effects.
- Effects that need CPU callbacks.
- Future collision/sub-emitter work.
- Precise lifecycle behavior.

## Limitations

- High particle counts become CPU-bound.
- Geometry buffers update every frame.
- Large ambience effects are better on GPU.
- Only the infinite plane collision shape exists; no mesh or primitive colliders yet.

