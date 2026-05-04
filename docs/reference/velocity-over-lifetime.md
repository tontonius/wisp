# Velocity Over Lifetime Reference

`velocityOverLifetime` adds a Unity-like per-age linear velocity channel.

```ts
type VelocityOverLifetime = {
  linear?: {
    x?: Curve;
    y?: Curve;
    z?: Curve;
  };
};
```

Preset example:

```ts
velocityOverLifetime: {
  linear: {
    x: [[0, 0], [1, 0]],
    y: [[0, 1.5], [1, -0.5]],
    z: [[0, 0], [1, 0]],
  },
}
```

## Evaluation

The module evaluates each curve at normalized particle age:

```ts
t = particle.age / particle.lifetime
```

Then it adds that vector to movement for the frame:

```ts
position += (storedVelocity + lifetimeLinearVelocity) * dt
```

Important distinction:

- `start.velocity` is sampled once and stored in particle velocity.
- `forces.acceleration`, `forces.noise`, and `forces.drag` mutate stored velocity.
- `velocityOverLifetime.linear` is evaluated each frame and added to movement.

This means `velocityOverLifetime` behaves like an authored velocity channel, not an accumulating acceleration.

## Axis Curves

Each axis is optional.

```ts
linear: {
  y: [[0, 2], [0.5, 0], [1, -1]],
}
```

Omitted axes default to zero.

## Use Cases

Rising then falling arc:

```ts
velocityOverLifetime: {
  linear: {
    y: [[0, 1.5], [1, -0.5]],
  },
}
```

Sideways sweep:

```ts
velocityOverLifetime: {
  linear: {
    x: [[0, -1], [1, 1]],
  },
}
```

Late upward drift:

```ts
velocityOverLifetime: {
  linear: {
    y: [[0, 0], [0.7, 0], [1, 0.8]],
  },
}
```

## Backend Notes

CPU:

- Curves are evaluated directly during `updateParticles`.

GPU:

- Curves are baked into a floating-point lookup texture.
- The simulation shader samples the texture by normalized age.

## Current Scope

Implemented:

- Linear X/Y/Z curves.

Not yet implemented:

- Local/world space switch.
- Orbital velocity.
- Radial velocity.
- Offset center.
- Speed modifier.

Those are natural extensions if the system keeps moving toward Unity Shuriken parity.

