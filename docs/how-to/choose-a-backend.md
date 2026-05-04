# Choose A Backend

Use this guide when deciding between `simulation: "cpu"`, `"gpu"`, and `"auto"`.

## Use CPU For Small Gameplay Effects

```ts
const hitSparks: ParticlePreset = {
  simulation: "cpu",
  maxParticles: 64,
  duration: 0.2,
  emission: { bursts: [{ time: 0, count: [20, 36] }] },
};
```

Choose CPU when you need:

- Small particle counts.
- Precise lifecycle callbacks.
- `onParticleDeath`.
- [`collision`](../reference/cpu-backend.md#collision-plane--sphere--box) (`plane`, `sphere`, or `box` primitives).
- Future sub-emitters.
- Gameplay-oriented effects like hit sparks or muzzle flashes.

## Use GPU For Large Visual Effects

```ts
const rain: ParticlePreset = {
  simulation: "gpu",
  maxParticles: 12000,
  duration: 12,
  loop: true,
  prewarm: true,
  autoDispose: false,
  emission: { rateOverTime: 1800 },
};
```

Choose GPU when you need:

- Thousands of particles.
- Ambient visual effects.
- Continuous emission.
- Additive or simple alpha rendering.
- No CPU particle callbacks.

Pass a renderer:

```ts
const particles = new ParticleWorld(scene, { rain }, { renderer });
```

## Use Auto For Scalable Defaults

```ts
simulation: "auto",
maxParticles: 5000,
```

`auto` chooses GPU when:

- A `THREE.WebGLRenderer` is available.
- `maxParticles >= 2048`.

Otherwise it chooses CPU.

## Force CPU Even With GPU Options

```ts
gpu: {
  forceCpuFallback: true,
}
```

This is useful for testing backend differences or temporarily disabling GPU simulation.

