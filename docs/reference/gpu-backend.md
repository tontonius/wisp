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
- `collision` is set (CPU-only; validation rejects `simulation: "gpu"` with collision).

## Defaults

| Field | Default |
| --- | --- |
| `maxParticles` | `1024` |
| `textureSize` | `ceil(sqrt(maxParticles))` |
| `duration` | `1` |
| `loop` | `false` |
| `gpu.maxSpawnPerFrame` | `maxParticles` |
| `bounds` | Disabled (no frustum culling) |

Capacity:

```ts
capacity = textureSize * textureSize
```

Only `maxParticles` slots are considered active, even if capacity is larger.

## Bounds And Culling

GPU systems can opt into explicit culling bounds:

```ts
bounds: {
  center: [0, 0, 0], // optional
  radius: 20,         // required, > 0
}
```

Behavior:

- When `bounds` is set, the GPU mesh uses frustum culling with this fixed bounding sphere.
- When `bounds` is omitted, GPU culling is disabled to avoid accidental clipping/pop-out.
- This is especially useful for large ambient effects (rain, snow, storms) where you know the effect volume ahead of time.

When to use it:

- Use `bounds` for long-running ambient GPU effects where you want predictable culling/perf.
- Skip `bounds` while authoring if you are unsure of spread; add it after the effect shape is stable.

How to pick values:

1. Start with a deliberately large radius so the effect never disappears.
2. Move the camera around the effect volume.
3. Reduce radius until clipping starts, then increase a little for safety margin.
4. If the effect is offset from the system origin, set `center` to match the real volume center.

Troubleshooting:

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Whole GPU effect disappears at once near screen edges | `bounds.radius` too small | Increase radius |
| Effect disappears only from some camera angles | `bounds.center` is misplaced | Move center toward real volume center |
| Effect never culls even when far away | `bounds` omitted (culling disabled) | Add explicit `bounds` |
| Effect culls too late / perf still high off-screen | Bounds are much larger than needed | Decrease radius gradually |

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

For `simulationSpace: "world"`, GPU spawn now uses the current system world transform for emitter samples:

- Spawn positions are transformed by the system world matrix.
- Spawn directions and `start.velocity` ranges are transformed by the system world orientation basis.
- This keeps moving/rotating world-space emitters aligned with their current transform at the spawn moment.

## Simulation Shader

The shader:

1. Checks whether the current slot is being spawned.
2. Samples emitter position and direction.
3. Initializes lifetime, velocity, color, size, rotation, angular velocity, opacity, and start frame.
4. For existing live particles, increments age.
5. Kills particles when age exceeds lifetime.
6. Applies constant acceleration, vortex force (if configured), coherent FBM noise, and drag.
7. Samples linear velocity-over-lifetime.
8. Integrates position and rotation (if `rotationBySpeed` is set, angular velocity is taken from its curve each step using current simulation speed).

## Render Shader

The render geometry is static:

- Six vertices per particle.
- Each vertex stores a corner and a particle-state UV.

The vertex shader:

- Samples GPU state textures.
- Computes size, opacity, color, rotation, atlas frame, and alignment (optional `colorBySpeed` / `sizeBySpeed` use current `|velocity|` from the simulation texture).
- Expands the billboard quad.

The fragment shader:

- Samples the particle texture.
- Multiplies texture color by particle color.
- Discards near-zero alpha.
- Optionally applies depth-based soft-particle fading when `renderer.softParticles` is enabled and a depth texture is provided via `setSoftParticleDepthTexture(...)`.

## Curve Textures

The GPU backend bakes these authoring values into lookup textures:

- `overLifetime.size`.
- `overLifetime.opacity`.
- `overLifetime.color`.
- `velocityOverLifetime.linear`.
- When set: `sizeBySpeed.curve` and `rotationBySpeed.angularVelocity` as **float** ramps (values may exceed `1`), and `colorBySpeed.gradient` as an sRGB strip. See [Speed-driven modules](speed-driven.md).

Preset mutations after construction do not update these lookup textures.

## Alive Count And Completion

GPU readback is intentionally avoided.

For non-looping systems, `isAlive` conservatively returns true until:

```ts
elapsed <= duration + maxStartLifetime
```

`aliveCount` returns `maxParticles` while the system may be alive.

This is approximate by design.

## Playback Semantics

- `pause()` freezes GPU simulation time (particles stop aging and forces stop integrating).
- `play()` resumes from the paused state.
- `restart()` clears GPU state and starts from time zero.
- `stop({ clear: true })` clears GPU state immediately.

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
- `limitVelocityOverLifetime`.
- Transparent particle sorting (the GPU backend ignores `renderer.sorting`; rely on additive blending or `depthWrite: false` alpha).
- Mesh emitters.
- Trails/ribbons.
- CPU readback.

Soft particles note:

- Supported as an opt-in render path (`renderer.softParticles` + `renderer.softness`) on the GPU backend.
- Requires external scene depth texture wiring from your renderer/composer pipeline.

