# Forces Reference

`forces` changes the stored particle velocity over time.

```ts
forces?: {
  acceleration?: Vec3Tuple;
  drag?: number;
  noise?: {
    strength?: number;
    frequency?: number;
  scroll?: [number, number, number];
  octaves?: number;
  lacunarity?: number;
  persistence?: number;
  };
};
```

If `forces` is omitted, particles keep their current velocity except for `velocityOverLifetime`, which is applied as an additional movement channel.

## Constant acceleration

```ts
acceleration: [0, -9.8, 0]
```

`acceleration` is a constant world-space acceleration vector (units per second squared) added to velocity every update:

```ts
velocity += acceleration * dt
```

Use it for gravity along any axis, wind bias, or other uniform pushes.

## Drag

```ts
drag: 2.2
```

Drag damps velocity every update:

```ts
velocity *= max(0, 1 - drag * dt)
```

Higher values slow particles more quickly. Very high values can clamp velocity to zero in a single frame.

## Noise

```ts
noise: {
  strength: 0.35,
  frequency: 4.5,
  scroll: [0.2, 0.35, 0.17],
  octaves: 2,
  lacunarity: 2,
  persistence: 0.5,
}
```

Noise uses coherent 3D value-noise FBM (Perlin-like behavior), sampled from particle position and animated by `scroll`.

Fields:

| Field | Default | Description |
| --- | --- | --- |
| `strength` | `0` | Amplitude of velocity perturbation. |
| `frequency` | `1` | Spatial scale of the noise field (`higher = finer detail`). |
| `scroll` | `[0.2, 0.35, 0.17]` | World-space advection speed of the noise field over time. |
| `octaves` | `2` | FBM octave count (`1..4`). |
| `lacunarity` | `2` | Frequency multiplier per octave (`>= 1`). |
| `persistence` | `0.5` | Amplitude multiplier per octave (`0 < p <= 1`). |

CPU and GPU both use coherent position-based formulas with per-particle offsets.

Use it for:

- Smoke wobble.
- Magic drift.
- Snow irregularity.
- Fire flicker.

Avoid it for:

- Exact physically based fluid simulation.
- Collision response.

## Force Order

Per update, the CPU backend applies:

1. Age increment and death check.
2. Constant acceleration.
3. Noise.
4. Drag.
5. Position integration using stored velocity plus lifetime velocity.
6. Angular velocity.

The GPU backend follows the same conceptual order inside the simulation shader.
