# CPU Backend Reference

The CPU backend stores each particle as JavaScript objects and updates geometry buffers every frame.

## Selection

CPU is used when:

- `simulation` is omitted.
- `simulation: "cpu"`.
- `simulation: "gpu"` is requested without a renderer.
- `simulation: "auto"` does not meet GPU criteria.
- `gpu.forceCpuFallback` is true.

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
8. Integrate rotation.

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

