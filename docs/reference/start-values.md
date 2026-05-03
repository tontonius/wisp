# Start Values Reference

`start` defines values sampled when each particle spawns.

```ts
start?: {
  lifetime?: Range;
  speed?: Range;
  size?: Range;
  rotation?: Range;
  angularVelocity?: Range;
  color?: THREE.ColorRepresentation | [THREE.ColorRepresentation, THREE.ColorRepresentation];
  opacity?: Range;
  velocity?: Vec3Range;
};
```

## Defaults

| Field | Default | Unit / Meaning |
| --- | --- | --- |
| `lifetime` | `1` | Seconds. Clamped to at least `0.01`. |
| `speed` | `1` | Units per second along emitter direction. |
| `size` | `0.2` | Billboard world size. |
| `rotation` | `0` | Radians. |
| `angularVelocity` | `0` | Radians per second. |
| `color` | `"#ffffff"` | Start color. |
| `opacity` | `1` | Start alpha. |
| `velocity` | `[0, 0, 0]` | Extra start velocity vector. |

## Lifetime

```ts
lifetime: [0.4, 1.1]
```

Lifetime controls when each particle dies. System `duration` controls emission, not particle death.

## Speed

```ts
speed: [2, 7]
```

Speed multiplies the emitter direction. Final starting velocity begins as:

```ts
emitterDirection * sampledSpeed
```

Then `start.velocity` is added.

## Size

```ts
size: [0.05, 0.25]
```

Size is the base billboard size before `overLifetime.size` is applied.

Final rendered size:

```ts
sampledStartSize * sizeCurve(age / lifetime)
```

## Rotation And Angular Velocity

```ts
rotation: [0, Math.PI * 2],
angularVelocity: [-8, 8],
```

Rotation is stored per particle in radians. Angular velocity is added every update.

## Color

```ts
color: "#ffffff"
color: ["#fff4ba", "#ff4b16"]
```

If a color pair is provided, the particle samples between the two colors at spawn.

Final rendered color:

```ts
sampledStartColor * colorGradient(age / lifetime)
```

If `overLifetime.color` is omitted, the lifetime color defaults to white.

## Opacity

```ts
opacity: [0.6, 1]
```

Final rendered opacity:

```ts
sampledStartOpacity * opacityCurve(age / lifetime)
```

If `overLifetime.opacity` is omitted, the lifetime opacity multiplier defaults to `1`.

## Velocity

```ts
velocity: [0, 1, 0]
```

or:

```ts
velocity: [
  [-0.2, 0.4, -0.2],
  [0.2, 1.2, 0.2],
]
```

This is an extra velocity sampled at spawn and added to emitter speed. It is not velocity-over-lifetime.

Starting velocity:

```ts
velocity = emitterDirection * start.speed + start.velocity
```

Use `velocity` for:

- Random lateral spread.
- Inherited character/projectile velocity.
- Upward bias.
- Per-particle start drift.

Use `velocityOverLifetime` for:

- Curved motion that changes over particle age.
- Unity-like linear velocity over lifetime.

