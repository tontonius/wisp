# Forces Reference

`forces` changes the stored particle velocity over time.

```ts
forces?: {
  acceleration?: Vec3Tuple;
  drag?: number;
  vortex?: {
    center?: [number, number, number];
    axis?: [number, number, number];
    orbitalSpeed?: number;
    inward?: number;
    upward?: number;
  };
  noise?: {
    strength?: number;
    frequency?: number;
    scroll?: [number, number, number];
    octaves?: number;
    lacunarity?: number;
    persistence?: number;
  };
  pointAttractor?: {
    center?: [number, number, number];
    strength?: number;
    strengthOverLifetime?: Array<[number, number]>;
    epsilon?: number;
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

## Point attractor

```ts
pointAttractor: {
  center: [0, 0, 0],
  strength: 6,
  strengthOverLifetime: [[0, 0], [0.3, 1], [1, 1]],
  epsilon: 1e-4,
}
```

Pulls particle **velocity** toward a single point in **simulation space** (see `simulationSpace` on the preset). Each frame, acceleration is along `(center - position)` with constant magnitude `|strength|` before lifetime scaling—this is not inverse-square gravity.

| Field | Default | Description |
| --- | --- | --- |
| `center` | `[0, 0, 0]` | Target position. |
| `strength` | `0` | Radial acceleration magnitude (units/s²). Negative values push **away** from `center`. |
| `strengthOverLifetime` | (unset) | Multiplies `strength`; evaluated at normalized age `age / lifetime`. If omitted, acts like a flat multiplier of `1`. |
| `epsilon` | `1e-4` | No pull when distance to `center` is below this (avoids unstable `normalize` near the target). |

Works on CPU and GPU. For a “spawn outward, then suck to the center” look, combine a spherical emitter, outward `start.velocity`, and a `strengthOverLifetime` curve that ramps from `0` to `1` over the first part of life.

## Vortex

```ts
vortex: {
  center: [0, 2.6, 0],
  axis: [0, 1, 0],
  orbitalSpeed: 10,
  inward: 3,
  upward: 1,
}
```

`vortex` pushes particle **velocity** each frame using the column through `center` in direction `axis`. It is **not** a rigid-body orbit solver and does not guarantee a perfect circle at any parameter pair.

### Geometry

- `center`: A point on the vortex line (the “base” of the column in preset space).
- `axis`: Direction of the column. The implementation **normalizes** this vector; if it is too close to zero it falls back to `[0, 1, 0]`.

From the particle position, the backend builds:

1. **Radial in the spin plane**: vector from the particle toward the axis line, flattened to the plane perpendicular to `axis` (distance to the column in cross-section).
2. **Tangent**: `normalize(cross(axis, radialInPlane))` — the direction particles are pushed to swirl around the axis (right-hand rule).

If the particle is extremely close to the axis in that plane (length below a small epsilon), the in-plane vortex terms are skipped for that step; `upward` still applies.

### What each scalar does

Each update, velocity gains three independent contributions (same on CPU and GPU):

- **`orbitalSpeed`**: adds `orbitalSpeed * dt` in the **tangent** direction. This continuously bends motion into a swirl. It does **not** mean “one revolution per second” or a fixed orbit radius.
- **`inward`**: adds velocity **toward** the axis line in the spin plane (`-radialInPlane * inward * dt` after normalization). Higher values pull trajectories into a tighter column.
- **`upward`**: adds velocity **along** `axis` (`axis * upward * dt`). Use negative values to pull particles down the column.

So `orbitalSpeed` and `inward` are **not** coupled so that “equal values = stable ring orbit.” They are two separate pushes; real circular motion would require a specific balance between speed, radius, and inward pull, which this model does not enforce automatically.

### Tuning and interaction with other modules

Vertical (or axial) motion **stacks** with anything else that changes velocity:

- `forces.acceleration` (for example gravity or a constant updraft).
- `forces.noise`.
- `start.velocity` and `velocityOverLifetime`.

`forces.drag` runs **after** vortex and noise on the CPU (see [Force Order](#force-order)); it damps runaway tangential speed from strong `orbitalSpeed`.

Practical starting point for a visible funnel: set `axis` to a clear unit direction (for example `[0, 1, 0]`), tune `inward` until the column width feels right, then add `orbitalSpeed` for swirl, then `upward` for lift. If motion is too fast along the axis, lower `upward` before stripping noise—often `upward` and constant `acceleration` on the same axis are both contributing.

Defaults:

- `center`: `[0, 0, 0]`
- `axis`: `[0, 1, 0]`
- `orbitalSpeed`: `0`
- `inward`: `0`
- `upward`: `0`

Works on both CPU and GPU backends.

## Limit Velocity Over Lifetime

This module is configured at the preset top-level (not inside `forces`):

```ts
limitVelocityOverLifetime: {
  speed: [[0, 6], [1, 2.5]],
  dampen: 1,
}
```

Behavior:

- The module evaluates `speed` by normalized age.
- If current speed exceeds the evaluated max, velocity is reduced toward the capped value.
- `dampen: 1` means hard clamp; lower values blend more softly.

This is different from drag:

- Drag continuously damps all velocity.
- Limit velocity only acts when speed is above the configured cap.

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
3. Point attractor (if configured).
4. Vortex.
5. Noise.
6. Drag.
7. Limit velocity over lifetime (if configured).
8. Position integration using stored velocity plus lifetime velocity.
9. Angular velocity.

The GPU backend follows the same conceptual order inside the simulation shader.
