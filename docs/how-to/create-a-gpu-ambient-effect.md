# Create A GPU Ambient Effect

This guide creates a looping GPU snow effect.

## Preset

```ts
const snowGpu: ParticlePreset = {
  simulation: "gpu",
  maxParticles: 10000,
  duration: 16,
  loop: true,
  prewarm: true,
  autoDispose: false,
  bounds: {
    center: [0, 0, 0],
    radius: 14,
  },
  gpu: {
    maxSpawnPerFrame: 768,
  },
  emitter: {
    type: "box",
    size: [12, 0.2, 12],
  },
  emission: {
    rateOverTime: 700,
  },
  start: {
    lifetime: [5, 9],
    speed: 0,
    size: [0.035, 0.12],
    color: ["#ffffff", "#cce9ff"],
    opacity: [0.45, 0.9],
    velocity: [[-0.45, -0.85, -0.25], [0.45, -1.8, 0.25]],
    rotation: [0, Math.PI * 2],
    angularVelocity: [-0.8, 0.8],
  },
  forces: {
    acceleration: [0, -0.08, 0],
    drag: 0.08,
    noise: { strength: 0.38, frequency: 1.7 },
  },
  overLifetime: {
    size: [[0, 0.7], [0.5, 1], [1, 0.9]],
    opacity: [[0, 0], [0.08, 1], [0.86, 1], [1, 0]],
    color: [[0, "#ffffff"], [1, "#d8f2ff"]],
  },
  renderer: {
    blendMode: "alpha",
    depthWrite: false,
  },
};
```

## Spawn It Above The Scene

```ts
const particles = new ParticleWorld(scene, { snowGpu }, { renderer });
particles.spawn("snowGpu", { position: [0, 6.5, 0] });
```

## Update It

```ts
particles.update(dt, camera);
```

## Notes

- `speed: 0` lets `start.velocity`, `forces.acceleration`, and noise define motion.
- `prewarm: true` avoids waiting for the volume to fill.
- `autoDispose: false` keeps the loop under your control.
- `bounds` enables stable frustum culling for large ambient volumes; increase `radius` if the whole effect disappears near camera edges.
- GPU `aliveCount` is approximate; do not use it as gameplay state.

