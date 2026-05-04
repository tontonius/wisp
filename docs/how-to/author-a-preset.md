# Author A Preset

Use this checklist to build an effect from scratch.

Presets are validated when you construct a [`ParticleSystem`](../reference/api.md); see [Preset validation](../reference/preset-validation.md) for rules and for `collectParticlePresetIssues` when authoring in an editor.

## 1. Pick The Backend

```ts
simulation: "cpu"
```

Use CPU first for small effects. Move to GPU when particle count or ambience demands it.

## 2. Set Capacity And Emission Duration

```ts
maxParticles: 128,
duration: 0.35,
loop: false,
```

For one-shots, `duration` is usually short. For loops, set `loop: true` and usually `autoDispose: false`.

## 3. Choose An Emitter

```ts
emitter: { type: "sphere", radius: 0.12, emitFrom: "volume" }
```

Use:

- Point for simple bursts.
- Sphere for explosions.
- Hemisphere for upward aura.
- Cone for directed effects.
- Box for rain, snow, or fields.

## 4. Add Emission

Burst:

```ts
emission: {
  bursts: [{ time: 0, count: [40, 70] }],
}
```

Continuous:

```ts
emission: {
  rateOverTime: 120,
}
```

## 5. Set Start Values

```ts
start: {
  lifetime: [0.4, 1.1],
  speed: [2, 6],
  size: [0.05, 0.18],
  color: ["#ffffff", "#ff9f1c"],
  opacity: [0.6, 1],
  rotation: [0, Math.PI * 2],
  angularVelocity: [-4, 4],
}
```

## 6. Shape Motion

```ts
forces: {
  acceleration: [0, -2, 0],
  drag: 1.5,
  noise: { strength: 0.2, frequency: 5 },
}
```

Use `start.velocity` for random start spread:

```ts
start: {
  velocity: [[-0.2, 0.3, -0.2], [0.2, 1.0, 0.2]],
}
```

Use `velocityOverLifetime` for per-age authored drift:

```ts
velocityOverLifetime: {
  linear: {
    y: [[0, 1.2], [1, -0.3]],
  },
}
```

## 7. Shape Appearance

```ts
overLifetime: {
  size: [[0, 0], [0.15, 1], [1, 0]],
  opacity: [[0, 0], [0.1, 1], [0.8, 1], [1, 0]],
  color: [[0, "#ffffff"], [0.35, "#ffcc33"], [1, "#331100"]],
}
```

## 8. Choose Rendering

```ts
renderer: {
  blendMode: "additive",
  align: "camera",
  depthWrite: false,
}
```

Use `align: "velocity"` for stretched spark textures or rain.

