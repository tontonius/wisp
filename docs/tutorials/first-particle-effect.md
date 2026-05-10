# First Particle Effect

This tutorial walks through building and spawning your first custom particle preset.

## 1. Create A Three.js Scene

```ts
import * as THREE from "three";
import { Wisp, type ParticlePreset } from "@tontonius/wisp";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3, 7);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
```

## 2. Define A Custom Preset

```ts
const sparkleBurst: ParticlePreset = {
  simulation: "cpu",
  maxParticles: 96,
  duration: 0.3,

  emitter: {
    type: "sphere",
    radius: 0.15,
    emitFrom: "volume",
  },

  emission: {
    bursts: [{ time: 0, count: [28, 44] }],
  },

  start: {
    lifetime: [0.6, 1.1],
    speed: [0.8, 2.4],
    size: [0.05, 0.16],
    color: ["#ffffff", "#7df9ff"],
    opacity: [0.65, 1],
    rotation: [0, 360],
    angularVelocity: [-344, 344],
  },

  forces: {
    acceleration: [0, 0.6, 0],
    drag: 1.8,
    noise: { strength: 0.2, frequency: 6 },
  },

  overLifetime: {
    size: [[0, 0], [0.18, 1], [1, 0]],
    opacity: [[0, 0], [0.12, 1], [0.8, 1], [1, 0]],
    color: [[0, "#ffffff"], [0.45, "#7df9ff"], [1, "#ffec8a"]],
  },

  renderer: {
    blendMode: "additive",
    depthWrite: false,
  },
};
```

## 3. Register And Spawn Your Custom Preset

```ts
const wisp = new Wisp({
  scene,
  camera,
  particles: {
    presets: { sparkleBurst },
    renderer,
  },
});

wisp.particles!.spawn("sparkleBurst", {
  position: [0, 0.4, 0],
});
```

`wisp.particles.spawn` adds the spawned `ParticleSystem` to `scene` and starts it by default.

## 4. Update Every Frame

```ts
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 1 / 30);
  wisp.update(dt);
  renderer.render(scene, camera);
}

animate();
```

One-shot systems auto-dispose when complete unless their preset sets `autoDispose: false`.

## 5. Try The Next Changes

Change the shape:

```ts
emitter: { type: "cone", radius: 0.05, angle: 18, length: 1.2 }
```

Add a lifetime velocity arc:

```ts
velocityOverLifetime: {
  linear: {
    y: [[0, 1.2], [1, -0.5]],
  },
}
```

Switch to GPU for high particle counts:

```ts
simulation: "gpu",
maxParticles: 4096,
```

GPU systems require a compatible renderer in `Wisp` particle options (`particles.renderer`) or low-level `ParticleSystemOptions`/`ParticleManagerOptions`. The supported production GPU path is currently the WebGL backend; the WebGPU selection is experimental v0 plumbing.
