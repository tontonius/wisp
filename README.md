# Wisp

Wisp is a modular game-feel effects engine for Three.js.

Today, two core modules are implemented:

- `particles`: a Unity-Shuriken-inspired foundation focused on game-ready ergonomics over exposing every possible low-level knob.
- `camera`: trauma-based camera shake that layers onto existing camera rigs.

## Features

Camera module:

- Trauma-based camera shake module (`Wisp` / `wisp.camera.shake`)
- Linear trauma decay with nonlinear response curve (`trauma^2` / `trauma^3` style tuning)
- Coherent time-based shake noise for smooth handheld-style motion

Particle module:

- Hybrid CPU/GPU simulation backend
- CPU backend for precise gameplay-ish effects
- GPU backend for large visual effects using WebGL render-target ping-pong simulation
- Point, sphere, hemisphere, cone, and box emitters
- Local-space or world-space simulation (`simulationSpace`)
- Continuous emission and burst emission
- Optional emitter-motion modules (`inheritVelocity`, `lifetimeByEmitterSpeed`)
- Size, opacity, and colour over lifetime
- Optional speed-driven colour, size multiplier, and spin (`colorBySpeed`, `sizeBySpeed`, `rotationBySpeed`)
- Constant acceleration vector, drag, vortex, and coherent noise force
- Billboard quad renderer
- Camera-aligned and velocity-aligned particles
- Alpha, additive, and multiply blending
- Texture support
- Texture-sheet / flipbook UV support
- JSON-style presets
- `ParticleWorld` manager with auto-cleanup

General:

- TypeScript-first API

## Install

Use the published package in your app:

```bash
npm install @tontonius/wisp three
```

For local development of this repository:

```bash
npm install
npm run dev
```

Then open the Vite URL.

## Demo controls

```txt
Click = spawn selected effect from the demo controls
```

The scene starts with a small CPU aura on the left and a larger GPU magic storm on the right.

## Documentation

The full Diataxis-style documentation set lives in [`docs/`](docs/index.md):

- Tutorials for first success.
- How-to guides for focused tasks.
- Reference pages for every public API and preset module.
- Explanations for architecture and backend tradeoffs.

Module entry points:

- [How To Add Trauma-Based Camera Shake](docs/how-to/add-camera-shake.md)
- [Reference: Camera Effects](docs/reference/camera-effects.md)
- [Tutorial: First Particle Effect](docs/tutorials/first-particle-effect.md)
- [Reference: Particle API](docs/reference/api.md)

## Basic usage

```ts
import * as THREE from "three";
import { Wisp, type ParticlePreset } from "@tontonius/wisp";

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

const wisp = new Wisp({
  scene,
  camera,
  particles: {
    presets: { explosion },
    renderer,
  },
});

wisp.particles?.spawn("explosion", {
  position: [0, 0, 0],
});

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  wisp.update(dt);

  renderer.render(scene, camera);
}
```

## Publishing (maintainers)

```bash
# 1) Log in once
npm login

# 2) Build library bundle + type declarations
npm run build:lib

# 3) Verify what will be published
npm pack --dry-run

# 4) First publish (or regular publish after version bump)
npm publish --access public
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
const wisp = new Wisp({
  scene,
  camera,
  particles: { presets: { magicStorm }, renderer },
});
wisp.particles?.spawn("magicStorm", { position: [0, 0, 0] });
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

- collisions (CPU supports primitive colliders: `plane`, `sphere`, `box`; see [`docs/reference/cpu-backend.md`](docs/reference/cpu-backend.md))
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

For white-on-black sprite images, additive blending can be useful. For alpha blending, use a transparent PNG or enable runtime luminance keying:

```ts
renderer: {
  texture,
  alphaFromLuminance: { enabled: true, blackCutoff: 32 },
  blendMode: "alpha",    // "additive" | "multiply"
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
    animationMode: "randomStart",
  },
}
```

For flipbook animation, use `animationMode`.

```ts
renderer: {
  texture: flipbookTexture,
  textureSheet: {
    columns: 4,
    rows: 4,
    animationMode: "randomStartOverLifetime",
  },
}
```

## Practical advice

Use:

- `simulation: "cpu"` for muzzle flashes, hit sparks, gameplay impacts, anything that will later want collisions or sub-emitters.
- `simulation: "gpu"` for thousands of visual-only particles.
- additive blending for GPU particles whenever possible. Alpha smoke without sorting is acceptable, but additive magic is the happy path. CPU presets get back-to-front sorting by default (`renderer.sorting: "distance"`).

This is still an MVP. A good one. Not a full Unity VFX Graph replacement, because we are sane people with calendars.
