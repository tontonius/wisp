# Over Lifetime Curves Reference

`overLifetime` controls visual properties by normalized particle age.

```ts
overLifetime?: {
  size?: Curve;
  opacity?: Curve;
  color?: Gradient;
};
```

Normalized age:

```ts
t = particle.age / particle.lifetime
```

## Size

```ts
size: [[0, 0], [0.2, 1], [1, 0]]
```

Size is a multiplier on `start.size`.

Final size:

```ts
startSize * evaluateCurve(overLifetime.size, t, 1)
```

Fallback multiplier is `1`.

## Opacity

```ts
opacity: [[0, 0], [0.12, 1], [0.8, 1], [1, 0]]
```

Opacity is a multiplier on `start.opacity`.

Final opacity:

```ts
startOpacity * evaluateCurve(overLifetime.opacity, t, 1)
```

Fallback multiplier is `1`.

## Color

```ts
color: [[0, "#ffffff"], [0.45, "#7df9ff"], [1, "#241033"]]
```

Color is multiplied with `start.color`.

Final color:

```ts
startColor * evaluateGradient(overLifetime.color, t)
```

Fallback gradient color is white.

## Curve Authoring Rules

- Use time values from `0` to `1` for lifetime-relative behavior.
- Stops should be ordered by time.
- Values before the first stop use the first stop value.
- Values after the last stop use the last stop value.
- Between stops, values interpolate linearly.

## Common Shapes

Fade in and fade out:

```ts
opacity: [[0, 0], [0.1, 1], [0.8, 1], [1, 0]]
```

Pop then shrink:

```ts
size: [[0, 0], [0.12, 1.2], [1, 0]]
```

Smoke growth:

```ts
size: [[0, 0.15], [0.25, 1], [1, 1.9]]
```

Heat color:

```ts
color: [[0, "#ffffff"], [0.35, "#ff9f1c"], [1, "#2b1209"]]
```

## GPU Notes

GPU curves and gradients are baked once when the backend is constructed. Mutating the preset object after construction does not rebuild those lookup textures.

To apply new lifetime curves to a live GPU effect, dispose and respawn the system.

