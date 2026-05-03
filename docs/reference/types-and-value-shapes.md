# Types And Value Shapes

This page documents the small reusable value shapes used throughout presets.

## `Range`

```ts
type Range = number | [number, number];
```

A `Range` accepts either:

- A scalar, used as-is.
- A two-number interval, sampled randomly per particle or per emission evaluation depending on the field.

Examples:

```ts
speed: 4
speed: [2, 7]
```

Semantics:

- For `start` values, ranges are sampled when each particle spawns.
- For burst counts, ranges are sampled when the burst fires.
- For `rateOverTime`, the current implementation samples while updating emission.

## `Vec3Tuple`

```ts
type Vec3Tuple = [number, number, number];
```

A 3D vector encoded as `[x, y, z]`.

Examples:

```ts
gravity: [0, -9.8, 0]
size: [12, 0.2, 12]
```

## `Vec3Range`

```ts
type Vec3Range = Vec3Tuple | [Vec3Tuple, Vec3Tuple];
```

Either a fixed 3D vector or a per-axis random interval between two vectors.

Example:

```ts
velocity: [0, 1, 0]

velocity: [
  [-0.4, 0.2, -0.4],
  [0.4, 1.2, 0.4],
]
```

Each axis is sampled independently between min and max.

## `Curve`

```ts
type Curve = Array<[time: number, value: number]>;
```

A piecewise-linear curve evaluated by normalized particle age.

Time values are usually in the `0..1` range:

- `0` means particle birth.
- `1` means particle death.

Example:

```ts
size: [[0, 0], [0.2, 1], [1, 0]]
```

Evaluation:

- Before the first stop, the first value is used.
- Between stops, values are linearly interpolated.
- After the last stop, the last value is used.

The system does not sort curve stops. Author them in increasing time order.

## `Gradient`

```ts
type Gradient = Array<[time: number, color: THREE.ColorRepresentation]>;
```

A piecewise-linear color gradient evaluated by normalized particle age.

Example:

```ts
color: [[0, "#ffffff"], [0.45, "#7df9ff"], [1, "#1b1040"]]
```

Colors are converted through `THREE.Color`, so any `THREE.ColorRepresentation` accepted by Three.js can be used.

## Backend Lookup Textures

The GPU backend bakes curves and gradients into small textures:

- Size curve: 256 pixels.
- Opacity curve: 256 pixels.
- Color gradient: 256 pixels.
- Linear velocity over lifetime: 256 floating-point samples.

This keeps CPU and GPU presets close in authoring shape, even though their runtime implementations are different.

