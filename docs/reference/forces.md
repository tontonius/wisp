# Forces Reference

`forces` changes the stored particle velocity over time.

```ts
forces?: {
  gravity?: Vec3Tuple;
  drag?: number;
  noise?: {
    strength?: number;
    frequency?: number;
  };
};
```

If `forces` is omitted, particles keep their current velocity except for `velocityOverLifetime`, which is applied as an additional movement channel.

## Gravity

```ts
gravity: [0, -9.8, 0]
```

Gravity is a constant acceleration added to velocity every update:

```ts
velocity += gravity * dt
```

Despite the field name, it can point in any direction.

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
}
```

Noise is simple deterministic sinusoidal turbulence. It is not spatial curl noise.

Fields:

| Field | Default | Description |
| --- | --- | --- |
| `strength` | `0` | Amplitude of velocity perturbation. |
| `frequency` | `1` | Temporal frequency of the sine/cosine perturbation. |

CPU and GPU both use similar formulas with particle seed and age.

Use it for:

- Smoke wobble.
- Magic drift.
- Snow irregularity.
- Fire flicker.

Avoid it for:

- Physically accurate turbulence.
- Collision response.
- Stable vector fields.

## Force Order

Per update, the CPU backend applies:

1. Age increment and death check.
2. Gravity.
3. Noise.
4. Drag.
5. Position integration using stored velocity plus lifetime velocity.
6. Angular velocity.

The GPU backend follows the same conceptual order inside the simulation shader.

