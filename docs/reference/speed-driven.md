# Speed-Driven Visual Modules

These optional top-level `ParticlePreset` fields remap the particle’s **current simulation speed** `|velocity|` into a parameter `t ∈ [0, 1]`, then sample curves or gradients (same `Curve` / `Gradient` types as `overLifetime`).

They are implemented on **both CPU and GPU** backends.

## Speed parameter

For each module, `speedRange: [min, max]` maps linearly:

- `speed ≤ min` → `t = 0`
- `speed ≥ max` → `t = 1`
- Between → linear interpolation

`max` must be `≥ min` (validation error otherwise).

**Important:** Speed is the magnitude of the **stored simulation velocity** only. It does **not** include the extra `velocityOverLifetime` offset that is added only during position integration.

## `colorBySpeed`

```ts
colorBySpeed?: {
  speedRange: [number, number];
  gradient: Gradient;
};
```

Multiplies RGB after `start.color` and `overLifetime.color` (same order as lifetime tint on the CPU path).

## `sizeBySpeed`

```ts
sizeBySpeed?: {
  speedRange: [number, number];
  curve: Curve;
};
```

Multiplies world size after `start.size` and `overLifetime.size`. Curve values are **not** clamped to `[0, 1]` (unlike baked opacity/size lifetime ramps on GPU), so multipliers such as `1.2` or `2` are valid.

On the **CPU** backend, primitive collision uses the same combined size when computing contact radius (after drag and `limitVelocityOverLifetime`, before position integration).

## `rotationBySpeed`

```ts
rotationBySpeed?: {
  speedRange: [number, number];
  angularVelocity: Curve;
};
```

Each frame, **replaces** the per-particle angular velocity sampled at spawn (`start.angularVelocity`) with the curve value at `t` (radians per second). Spin still integrates as `rotation += angularVelocity * dt`.

## GPU notes

- `sizeBySpeed` and `rotationBySpeed` use **float** 1D lookup textures so curve values can exceed `1`.
- `colorBySpeed` uses the same sRGB gradient texture path as `overLifetime.color`.
- `rotationBySpeed` is evaluated in the **simulation** pass; `colorBySpeed` and `sizeBySpeed` are evaluated in the **render** vertex shader from current `|velocity|`.

## Demo

The demo preset **`speedVisualDemo`** (label **Speed visual (CPU)** in the click dropdown) shows all three modules on a CPU cone burst.
