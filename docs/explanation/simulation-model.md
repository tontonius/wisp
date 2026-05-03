# Simulation Model

Each particle follows the same conceptual lifecycle:

```txt
spawn -> update until age >= lifetime -> die
```

## Spawn

At spawn time, the system samples:

- Emitter position.
- Emitter direction.
- Lifetime.
- Speed.
- Extra start velocity.
- Size.
- Opacity.
- Color.
- Rotation.
- Angular velocity.
- Texture sheet start frame.

Starting velocity is:

```ts
velocity = emitterDirection * start.speed + start.velocity
```

## Update

On each update:

1. Age advances.
2. Dead particles are removed or cleared.
3. Gravity changes stored velocity.
4. Noise changes stored velocity.
5. Drag damps stored velocity.
6. Velocity-over-lifetime is evaluated.
7. Position advances.
8. Rotation advances.

Position integration uses:

```ts
position += (storedVelocity + velocityOverLifetimeLinear) * dt
```

## Lifetime Values

Visual lifetime curves use normalized age:

```ts
t = age / lifetime
```

This drives:

- Size multiplier.
- Opacity multiplier.
- Color gradient.
- Texture sheet frame advancement.
- Linear velocity over lifetime.

## System Duration Versus Particle Lifetime

`duration` is the emission timeline. `start.lifetime` is the particle lifetime.

A system can stop emitting after `0.2` seconds while particles live for `1.0` seconds.

This is why one-shot systems may remain alive after emission completes.

## Looping

When `loop: true`, elapsed emission time wraps after `duration`.

Consequences:

- Continuous emission keeps running.
- Burst cursor resets.
- Scheduled bursts can fire again each loop.

## Prewarm

`prewarm: true` simulates one full duration before the effect is presented.

This is useful for looping effects where an empty first second would look wrong.

