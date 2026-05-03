# GPU Backend Reference

The GPU backend stores particle state in floating-point render targets and updates particles with fullscreen simulation passes.

## Selection

GPU is used when:

- `simulation: "gpu"` and a `THREE.WebGLRenderer` is available.
- `simulation: "auto"`, a renderer is available, and `maxParticles >= 2048`.

GPU is not used when:

- No renderer is available.
- `simulation: "cpu"`.
- `gpu.forceCpuFallback` is true.

## Defaults

| Field | Default |
| --- | --- |
| `maxParticles` | `1024` |
| `textureSize` | `ceil(sqrt(maxParticles))` |
| `duration` | `1` |
| `loop` | `false` |
| `gpu.maxSpawnPerFrame` | `maxParticles` |

Capacity:

```ts
capacity = textureSize * textureSize
```

Only `maxParticles` slots are considered active, even if capacity is larger.

## Render Targets

The backend uses two sets of four render targets for ping-pong simulation:

```txt
0: position + age
1: velocity + lifetime
2: start color + seed
3: size + rotation + angular velocity + opacity/alive/startFrame
```

Each simulation pass renders a fullscreen quad into each target.

## Spawn Behavior

`emit(count)` queues one or more spawn requests:

```ts
{ start, count, seed }
```

The spawn cursor cycles through particle slots. New particles overwrite old slots if the cursor wraps.

`gpu.maxSpawnPerFrame` clamps how many requested particles are queued by one `emit(count)`.

## Simulation Shader

The shader:

1. Checks whether the current slot is being spawned.
2. Samples emitter position and direction.
3. Initializes lifetime, velocity, color, size, rotation, angular velocity, opacity, and start frame.
4. For existing live particles, increments age.
5. Kills particles when age exceeds lifetime.
6. Applies gravity, noise, and drag.
7. Samples linear velocity-over-lifetime.
8. Integrates position and rotation.

## Render Shader

The render geometry is static:

- Six vertices per particle.
- Each vertex stores a corner and a particle-state UV.

The vertex shader:

- Samples GPU state textures.
- Computes size, opacity, color, rotation, atlas frame, and alignment.
- Expands the billboard quad.

The fragment shader:

- Samples the particle texture.
- Multiplies texture color by particle color.
- Discards near-zero alpha.

## Curve Textures

The GPU backend bakes these authoring values into lookup textures:

- `overLifetime.size`.
- `overLifetime.opacity`.
- `overLifetime.color`.
- `velocityOverLifetime.linear`.

Preset mutations after construction do not update these lookup textures.

## Alive Count And Completion

GPU readback is intentionally avoided.

For non-looping systems, `isAlive` conservatively returns true until:

```ts
elapsed <= duration + maxStartLifetime
```

`aliveCount` returns `maxParticles` while the system may be alive.

This is approximate by design.

## Strengths

Use GPU for:

- Thousands of particles.
- Rain.
- Snow.
- Ambient magic.
- Fireflies.
- Large additive visual effects.

## Limitations

Current GPU backend does not support:

- CPU particle death callbacks.
- Collision.
- Sub-emitters.
- Transparent particle sorting.
- Mesh emitters.
- Trails/ribbons.
- CPU readback.

