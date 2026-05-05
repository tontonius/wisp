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

If `inheritVelocity` is set, spawn velocity additionally includes emitter motion:

```ts
velocity += emitterVelocity * inheritVelocity.factor
```

If `lifetimeByEmitterSpeed` is set, spawn lifetime is remapped from emitter speed and overrides `start.lifetime`:

```ts
t = remap(|emitterVelocity|, speedRange)
lifetime = lerp(lifetimeRange[0], lifetimeRange[1], t)
```

If no dead slot exists, the spawn is skipped.

Simulation-space notes:

- `simulationSpace: "local"` (default): spawned particles remain in local space and follow later system transforms.
- `simulationSpace: "world"`: spawn samples are transformed to world space once, then simulated in world space.

## Update Behavior

Per live particle:

1. Increase age.
2. Kill particle if age exceeds lifetime.
3. Apply constant acceleration.
4. Apply procedural noise.
5. Apply drag.
6. Evaluate velocity over lifetime.
7. Integrate position.
8. If `collision` is set, resolve penetration against the configured primitive (`plane`, `sphere`, or `box`) with bounce/dampening or `killOnCollision`.
9. If `subEmitters.onCollision` is set and the system is managed by a `ParticleManager`, spawn that named effect at collision positions.
10. If `subEmitters.onDeath` is set and the system is managed by a `ParticleManager`, spawn that named effect at particle death positions.
11. Integrate rotation (if `rotationBySpeed` is set, angular velocity comes from that curve each frame instead of the spawned `start.angularVelocity`).

During spawn, if `subEmitters.onBirth` is set and the system is managed by a `ParticleManager`, that named child effect is spawned at each CPU particle birth position.

Speed-driven tint and size (`colorBySpeed`, `sizeBySpeed`) are applied when building billboard vertices from current simulation velocity. See [Speed-driven modules](speed-driven.md).

## Collision (plane / sphere / box)

```ts
collision?: {
  type: "plane" | "sphere" | "box";
  // plane
  y?: number;
  // sphere / box
  center?: [number, number, number];
  // sphere
  radius?: number;
  // box
  size?: [number, number, number];
  bounce?: number;
  dampening?: number;
  killOnCollision?: boolean;
};
```

| Field | Default | Description |
| --- | --- | --- |
| `type` | — | Collision primitive: `plane`, `sphere`, or `box`. |
| `y` | `0` | Plane-only: height of the infinite `xz` plane along simulation-space Y. |
| `center` | `[0, 0, 0]` | Sphere/box-only: primitive center in simulation space. |
| `radius` | `1` | Sphere-only: collider radius in simulation-space units. |
| `size` | `[1, 1, 1]` | Box-only: full extents of the axis-aligned simulation-space box. |
| `bounce` | `0.4` | Restitution on the collision normal. |
| `dampening` | `1` | Tangential damping after collision response (`1` keeps full tangential speed). |
| `killOnCollision` | `false` | When true, particles die on collision instead of bouncing/sliding. |

Implementation notes:

- `plane` uses normal **+Y** and corrects particles below `y`.
- `sphere` pushes particles to the sphere surface and responds along outward normal.
- `box` uses an axis-aligned box and resolves against the nearest face.
- Collision space matches `simulationSpace`.
- In `local` space, moving/rotating/scaling the `ParticleSystem` transforms collider behavior with it.
- In `world` space, colliders stay fixed in world coordinates unless the preset values are changed.

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
- `onBirth`, `onDeath`, and `onCollision` are named effects looked up in `ParticleManager.effects`.
- Trigger source:
  - `onBirth`: when a CPU particle is spawned.
  - `onDeath`: every CPU particle death (lifetime expiry or `killOnCollision`).
  - `onCollision`: when a CPU particle penetrates the collision plane.
- Spawn location:
  - `onBirth`: spawned particle position in world space.
  - `onDeath`: particle death position in world space.
  - `onCollision`: collision-resolved position in world space.
- Triggering requires systems spawned through `ParticleManager` (standalone `ParticleSystem` does not resolve named child effects).
- GPU presets must not set `subEmitters`; validation rejects `simulation: "gpu"` with `subEmitters`.

## Geometry Behavior

The CPU backend uses:

- One `THREE.BufferGeometry`.
- Six vertices per particle.
- `position`, `uv`, and `particleColor` attributes.

Every update:

- Alive particles are gathered into a sorted index list (see below).
- Live particles write quad vertices in sort order.
- `setDrawRange` limits rendering to live quads.
- Buffer attributes are marked for update.
- Bounding sphere is recomputed when particles are alive.

Renderer notes:

- `renderer.type: "billboard"` keeps symmetric quads.
- `renderer.type: "stretchedBillboard"` elongates quads along velocity, scaled by speed (`stretchFactor`) and clamped by `stretchMaxScale`.

### Particle Sorting

`renderer.sorting` controls the draw order each frame. Default is `"distance"` (back-to-front by world-space camera depth), which makes alpha-blended particles layer correctly without any extra setup. Other modes are `"none"`, `"youngestFirst"`, and `"oldestFirst"`. The sort runs on the CPU at `O(n log n)` over alive particles and reuses scratch buffers (no per-frame allocation). See [Renderer reference](renderer.md#sorting) for the full table.

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
- Collision is still primitive-only (`plane` / `sphere` / `box`); there is no mesh/raycast scene collision yet.

