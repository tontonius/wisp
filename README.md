# Three Particles MVP

A small Unity-Shuriken-inspired particle system for Three.js.

It is designed for game effects where the developer ergonomics matter more than exposing every cursed knob known to mankind.

## Features

- Hybrid CPU/GPU simulation backend
- CPU backend for precise gameplay-ish effects
- GPU backend for large visual effects using WebGL render-target ping-pong simulation
- Point, sphere, hemisphere, cone, and box emitters
- Continuous emission and burst emission
- Size, opacity, and colour over lifetime
- Constant acceleration vector, drag, and simple noise force
- Billboard quad renderer
- Camera-aligned and velocity-aligned particles
- Alpha, additive, and multiply blending
- Texture support
- Texture-sheet / flipbook UV support
- JSON-style presets
- `ParticleWorld` manager with auto-cleanup
- TypeScript-first API

## Install

This demo package is intentionally simple.

```bash
npm install
npm run dev
```

Then open the Vite URL.

## Demo controls

```txt
Click = CPU explosion + smoke
1     = CPU muzzle flash
2     = CPU smoke puff
3     = CPU explosion
4     = spawn another GPU magic storm burst
```

The scene starts with a small CPU aura on the left and a larger GPU magic storm on the right.

## Documentation

The full Diataxis-style documentation set lives in [`docs/`](docs/index.md):

- Tutorials for first success.
- How-to guides for focused tasks.
- Reference pages for every public API and preset module.
- Explanations for architecture and backend tradeoffs.

## Basic usage

```ts
import * as THREE from "three";
import { ParticleWorld, ParticlePreset } from "./src";

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();

const explosion: ParticlePreset = {
  maxParticles: 160,
  duration: 0.25,

  emitter: {
    type: "sphere",
    radius: 0.1,
    emitFrom: "volume",
  },

  emission: {
    bursts: [{ time: 0, count: [80, 120] }],
  },

  start: {
    lifetime: [0.4, 1.1],
    speed: [2, 7],
    size: [0.05, 0.25],
    color: ["#fff4ba", "#ff4b16"],
    opacity: [0.6, 1],
    rotation: [0, Math.PI * 2],
    angularVelocity: [-4, 4],
  },

  forces: {
    acceleration: [0, -2, 0],
    drag: 2,
  },

  overLifetime: {
    size: [
      [0, 1],
      [1, 0],
    ],
    opacity: [
      [0, 1],
      [1, 0],
    ],
    color: [
      [0, "#ffffff"],
      [0.3, "#ffcc33"],
      [1, "#333333"],
    ],
  },

  renderer: {
    blendMode: "additive",
    depthWrite: false,
  },
};

const particles = new ParticleWorld(scene, { explosion }, { renderer });

particles.spawn("explosion", {
  position: [0, 0, 0],
});

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  particles.update(dt, camera);

  renderer.render(scene, camera);
}
```

## CPU vs GPU backend

Use CPU for small, interactive effects:

```ts
const bulletImpact: ParticlePreset = {
  simulation: "cpu",
  maxParticles: 64,
  duration: 0.2,
  emission: {
    bursts: [{ time: 0, count: 32 }],
  },
};
```

Use GPU for large visual effects:

```ts
const magicStorm: ParticlePreset = {
  simulation: "gpu",
  maxParticles: 8192,
  duration: 6,
  loop: true,
  autoDispose: false,

  emitter: {
    type: "box",
    size: [10, 4, 10],
  },

  emission: {
    rateOverTime: 900,
  },

  start: {
    lifetime: [2.5, 5.5],
    speed: [0.02, 0.22],
    size: [0.025, 0.11],
    color: ["#6ee7ff", "#d8b4fe"],
    opacity: [0.25, 0.85],
    velocity: [
      [-0.08, 0.04, -0.08],
      [0.08, 0.34, 0.08],
    ],
  },

  renderer: {
    blendMode: "additive",
    depthWrite: false,
  },
};
```

Then:

```ts
const particles = new ParticleWorld(scene, { magicStorm }, { renderer });
particles.spawn("magicStorm", { position: [0, 0, 0] });
```

If you create a GPU `ParticleSystem` manually, pass the renderer:

```ts
const system = new ParticleSystem(magicStorm, { renderer });
scene.add(system);
system.play();
```

If `simulation: "gpu"` is requested without a renderer, the system falls back to CPU and logs a warning. Yes, it tattles. Correctly.

## Lifecycle

Every spawned `ParticleSystem` exposes:

```ts
system.isPlaying;
system.isAlive;
system.isComplete;
system.elapsed;
system.aliveCount;
```

Presets can also provide lifecycle callbacks:

```ts
const sparks: ParticlePreset = {
  callbacks: {
    onStart: (system) => console.log("started", system.elapsed),
    onComplete: (system) => console.log("done", system.aliveCount),
    onParticleDeath: (particle) => console.log("cpu particle died", particle.position),
  },
};
```

`onStart`, `onStop`, and `onComplete` work on both CPU and GPU systems. `onParticleDeath` is CPU-only because GPU particle death stays on the GPU.

## Debug Gizmos

Emitter gizmos can be enabled per preset:

```ts
const coneBurst: ParticlePreset = {
  emitter: { type: "cone", radius: 0.2, angle: 30, length: 2 },
  debug: {
    enabled: true,
    emitter: true,
    spawnDirection: true,
  },
};
```

Or toggled at runtime:

```ts
system.setDebug(true);
particles.setDebug({ enabled: true, color: "#78d7ff" });
```

The current gizmos show point, sphere, hemisphere, cone, and box emitter shapes. Cone gizmos include the base radius, length, angle spread, and forward spawn direction.

## `simulation: "auto"`

`auto` uses GPU when:

- a `WebGLRenderer` is available
- `maxParticles >= 2048`

Otherwise it uses CPU.

```ts
const preset: ParticlePreset = {
  simulation: "auto",
  maxParticles: 5000,
};
```

## GPU backend notes

The GPU backend uses four floating-point render targets:

```txt
position + age
velocity + lifetime
start colour + seed
size + rotation + angular velocity + opacity/alive
```

Each update runs a fullscreen simulation pass and then renders static billboard quads that sample the simulated particle state.

Curves and gradients are baked into tiny lookup textures, so this authoring shape still works:

```ts
overLifetime: {
  size: [[0, 0], [0.2, 1], [1, 0]],
  opacity: [[0, 0], [0.2, 1], [1, 0]],
  color: [[0, "#ffffff"], [1, "#7755ff"]],
}
```

Velocity over lifetime adds a per-age linear velocity channel on top of the particle's simulated velocity:

```ts
velocityOverLifetime: {
  linear: {
    x: [[0, 0], [1, 0]],
    y: [[0, 1.5], [1, -0.5]],
    z: [[0, 0], [1, 0]],
  },
}
```

### GPU backend supports

- point / sphere / hemisphere / cone / box emitters
- continuous emission
- burst emission via `emit(count)` or preset bursts
- lifetime / speed / size / opacity / colour ranges
- start velocity ranges
- linear velocity over lifetime
- constant acceleration (`forces.acceleration`)
- drag
- simple procedural noise
- size / opacity / colour over lifetime
- texture sheets
- additive / alpha / multiply blending
- camera-aligned and velocity-aligned billboards

### GPU backend does not yet support

- collisions (CPU has an optional infinite horizontal plane; see [`docs/reference/cpu-backend.md`](docs/reference/cpu-backend.md))
- sub-emitters
- transparent particle sorting (CPU sorts back-to-front by default via `renderer.sorting`; GPU renders unsorted)
- mesh emitters
- trails/ribbons
- particle lights
- CPU readback

For smoke, additive magic, sparks, snow, embers, rain, fireflies, motes, portals, and general “make the GPU sweat prettily”, it is already useful.

## Main concepts

### `ParticlePreset`

A serialisable-ish description of an effect.

```ts
const preset: ParticlePreset = {
  maxParticles: 100,
  duration: 1,
  loop: false,
  emitter: { type: "point" },
  emission: { bursts: [{ time: 0, count: 20 }] },
};
```

### `ParticleWorld`

The easiest way to use the system in a game.

```ts
const particles = new ParticleWorld(scene, {
  muzzleFlash,
  smokePuff,
  explosion,
}, { renderer });

particles.spawn("muzzleFlash", { position: gunTip });
particles.update(dt, camera);
```

One-shot systems auto-dispose by default when complete.

Most `start` values accept either a scalar or an interval:

```ts
start: {
  rotation: Math.PI * 0.25,
  angularVelocity: [-2, 2],
}
```

### `ParticleSystem`

A single live particle effect. It extends `THREE.Object3D`.

```ts
const system = new ParticleSystem(explosionPreset, { renderer });
scene.add(system);
system.play();
system.update(dt, camera);
```

Useful methods:

```ts
system.play();
system.pause();
system.stop();
system.restart();
system.emit(20);
system.dispose();
```

Useful getters:

```ts
system.isAlive;
system.isPlaying;
system.isComplete;
system.isDisposed;
system.backendType; // "cpu" | "gpu"
```

## Emitters

### Point

```ts
emitter: { type: "point" }
```

### Sphere

```ts
emitter: {
  type: "sphere",
  radius: 1,
  emitFrom: "volume", // or "shell"
}
```

### Hemisphere

```ts
emitter: {
  type: "hemisphere",
  radius: 1.5,
  emitFrom: "shell",
}
```

### Cone

Cone emits along local +Y.

```ts
emitter: {
  type: "cone",
  radius: 0.1,
  angle: 20,
  length: 1,
}
```

### Box

```ts
emitter: {
  type: "box",
  size: [10, 2, 10],
}
```

## Renderer

```ts
const texture = new THREE.TextureLoader().load("/particles/smoke-puff.png");
texture.colorSpace = THREE.SRGBColorSpace;

const smoke: ParticlePreset = {
  renderer: {
    texture,
    blendMode: "alpha",
    align: "camera",
    depthWrite: false,
  },
};
```

For white-on-black sprite images, additive blending can be useful. For alpha blending, use a transparent PNG or preprocess the image so the dark background becomes alpha.

```ts
renderer: {
  texture,
  blendMode: "additive", // "alpha" | "multiply"
  align: "camera",       // "velocity"
  depthWrite: false,
}
```

## Texture sheets

```ts
renderer: {
  texture: flipbookTexture,
  textureSheet: {
    columns: 4,
    rows: 4,
    randomFrame: true,
  },
}
```

For flipbook animation, advance frames over each particle lifetime. `randomStartFrame` remains supported as an alias for `randomFrame`.

```ts
renderer: {
  texture: flipbookTexture,
  textureSheet: {
    columns: 4,
    rows: 4,
    frameOverLifetime: true,
    randomFrame: true,
  },
}
```

## Practical advice

Use:

- `simulation: "cpu"` for muzzle flashes, hit sparks, gameplay impacts, anything that will later want collisions or sub-emitters.
- `simulation: "gpu"` for thousands of visual-only particles.
- additive blending for GPU particles whenever possible. Alpha smoke without sorting is acceptable, but additive magic is the happy path. CPU presets get back-to-front sorting by default (`renderer.sorting: "distance"`).

This is still an MVP. A good one. Not a full Unity VFX Graph replacement, because we are sane people with calendars.
