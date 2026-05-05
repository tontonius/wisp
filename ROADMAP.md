# Three Particles Roadmap

This document describes the current state of the Three.js particle system library and the planned roadmap ahead.

The goal is to build a reusable, Unity/Shuriken-inspired particle system for Three.js games with strong developer ergonomics, JSON-style presets, and both CPU and GPU simulation backends.

## North Star

The ideal user-facing API should feel like this:

```ts
particles.spawn("fireballImpact", {
  position: hit.point,
  normal: hit.normal,
});

particles.spawn("snowstorm", {
  parent: level,
  simulation: "gpu",
});

particles.spawn("dashTrail", {
  follow: player,
  duration: 0.25,
});
```

The developer should not have to think about render targets, ping-pong buffers, shader uniforms, particle state textures, or CPU/GPU implementation details unless they explicitly opt into low-level control.

The guiding principle:

> Unity-like expressive authoring, Three.js-native runtime, clean game ergonomics.

## Current Architecture

The library currently has a hybrid architecture:

```txt
ParticleWorld
  └─ ParticleSystem
      ├─ CPU backend
      └─ GPU backend
```

The public API is preset-driven and mostly shared across backends.

A particle preset can choose its simulation backend:

```ts
simulation: "cpu" | "gpu" | "auto"
```

The intended split is:

```txt
CPU backend:
  small
  precise
  gameplay-related
  collision-heavy
  sequenced
  sub-emitter-heavy

GPU backend:
  large
  ambient
  visual-only
  additive
  continuous
  non-colliding
  high particle count
```

Do not try to make one backend solve every problem. The hybrid model is intentional.

## What Is Already Added

### Core Library

- `ParticleWorld`
- `ParticleSystem`
- JSON-style `ParticlePreset`
- Named effect registry
- `spawn("effectName", { position })`
- `play()`
- `pause()`
- `stop()`
- `restart()`
- `emit(count)`
- `dispose()`
- `isPlaying`
- `isAlive`
- `isComplete`
- `elapsed`
- `aliveCount`
- Lifecycle callbacks (`onStart`, `onStop`, `onComplete`)
- CPU particle death callback (`onParticleDeath`)
- Emitter debug gizmos for point, sphere, hemisphere, cone, and box shapes
- One-shot lifecycle support
- Auto-cleanup through `ParticleWorld`
- Shared authoring model for CPU and GPU presets

### CPU Backend

The CPU backend is intended for precise gameplay-facing effects.

Currently supports:

- Point emitter
- Sphere emitter
- Hemisphere emitter
- Cone emitter
- Box emitter
- Continuous emission
- Burst emission
- Random lifetime
- Random speed
- Random size
- Random colour
- Random rotation
- Constant acceleration (`forces.acceleration`)
- Drag
- Noise
- Size over lifetime
- Opacity over lifetime
- Colour over lifetime
- Texture support
- Texture sheet animation
- Camera-facing billboards
- Velocity-aligned particles
- One-shot and looping systems

Best used for:

- Muzzle flashes
- Bullet impacts
- Sparks
- Small explosions
- Pickup effects
- Effects tied closely to gameplay
- Effects that may later need collision or sub-emitters

### GPU Backend

The GPU backend is intended for large visual-only particle systems.

Currently supports:

- WebGL render-target ping-pong simulation
- Large particle counts
- Continuous emission
- Bursts via `emit(count)`
- Curve lookup textures
- Gradient lookup textures
- Billboard rendering on GPU
- Point emitter
- Sphere emitter
- Hemisphere emitter
- Cone emitter
- Box emitter
- Constant acceleration (`forces.acceleration`)
- Drag
- Noise
- Randomised start values
- Texture sheet support
- Additive blending
- Alpha blending

Best used for:

- Magic storms
- Rain
- Snow
- Dust motes
- Embers
- Fireflies
- Ambient atmosphere
- Large stylised visual swarms

## Known Limitations

### CPU Backend Limitations

- No CPU-side particle object pooling (distinct from opt-in `ParticleWorld` system pooling)
- Primitive collision only (`plane` / `sphere` / `box`; no raycast/mesh yet)
- Sub-emitters are CPU-only (`onBirth`, `onDeath`, `onCollision`)
- No trail/ribbon renderer yet
- No soft particles yet
- No in-engine visual authoring beyond emitter gizmos; the **demo** includes a preset playground/editor (not a runtime library feature)

### GPU Backend Limitations

- No arbitrary scene collision
- No built-in sub-emitters
- No particle sorting
- No CPU readback for per-particle events
- No trails/ribbons
- No lights
- No mesh emitters
- No WebGPU compute backend yet

### Transparency Sorting

CPU particles sort back-to-front by camera distance by default (`renderer.sorting: "distance"`); other modes are `"none"`, `"youngestFirst"`, and `"oldestFirst"`. GPU particles are currently rendered unsorted.

Recommended strategies for GPU systems:

- Prefer additive blending for sparks, fire, magic, and glows.
- Use alpha blending with `depthWrite: false` for smoke-like effects.
- Do not attempt full GPU sorting in the MVP. It is expensive and complexity-heavy.

## Roadmap Overview

The roadmap is split into milestones.

## Milestone 1 — Stabilise the Library

Goal: make the library pleasant and robust in real game scenes.

### Status (library + demo)

**Done**

- `aliveCount`, `elapsed`, and lifecycle flags (`isPlaying`, `isAlive`, `isComplete`)
- Lifecycle callbacks (`onStart`, `onStop`, `onComplete`) and CPU `onParticleDeath`
- Auto-cleanup via `ParticleWorld` when `autoDispose` completes a system
- Diataxis docs in `docs/` and a demo preset editor / debug gizmos (see `docs/reference/demo-editor.md`)
- Demo ships the example presets below (selectable in the playground)
- Opt-in inactive-system pooling on `ParticleWorld` (`pooling` in `ParticleWorldOptions`)
- Preset validation at `ParticleSystem` construction (`collectParticlePresetIssues`, `assertValidParticlePreset`; see `docs/reference/preset-validation.md`)
- `ParticleWorld.preload(name, count)` warm-cache API for inactive pooled instances

**Watchlist**

- Broader “safer cleanup” hardening if gaps show up in real scenes

### Features

- [x] Real system pooling (`ParticleWorldOptions.pooling`)
- [x] `aliveCount`
- [x] `elapsed`
- [x] Better lifecycle state (flags + callbacks as above)
- [~] Safer cleanup (`autoDispose` + `clear()` + optional pooling; further hardening TBD)
- [x] Preset validation (`assertValidParticlePreset` on `ParticleSystem` construction)
- [x] `preload(name, count)` warm-cache API on `ParticleWorld`
- [~] Better TypeScript types (stronger shapes and reference docs; can tighten further)
- [x] Better documentation (`docs/`)
- [x] More example effects (see list below — all in `demo/main.ts`)

### Proposed API

```ts
particles.preload("muzzleFlash", 32);
particles.spawn("muzzleFlash", { position });
```

Internally:

```txt
inactive pool -> activate -> play -> complete -> return to pool
```

### Lifecycle API

Implemented on `ParticleSystem` (delegates to each backend where applicable):

```ts
system.isPlaying
system.isAlive
system.isComplete
system.elapsed
system.aliveCount
```

Callbacks:

```ts
onStart
onStop
onComplete
onParticleDeath
```

Callback support should be backend-aware:

```txt
CPU-only:
  onParticleDeath

CPU/GPU:
  onStart
  onStop
  onComplete
```

### Example Effects To Ship

- [x] Muzzle flash
- [x] Bullet impact sparks
- [x] Explosion
- [x] Smoke puff
- [x] Pickup sparkle
- [x] Torch fire
- [x] Rain GPU example
- [x] Snow GPU example
- [x] Magic aura GPU example

### Priority

High.

This is the “usable library” milestone.

## Milestone 2 — Gameplay Effects

Goal: make CPU particles excellent for responsive game juice.

### Features

- [x] CPU plane collision
- [x] CPU primitive collision (`collision.type: "sphere" | "box"`)
- [x] CPU sub-emitters (`onBirth`, `onDeath`, `onCollision`)
- [x] Stretched billboards
- [x] CPU sorting (`renderer.sorting`: `none` / `distance` / `youngestFirst` / `oldestFirst`, defaults to `distance`)
- [x] Better local/world simulation support (`simulationSpace: "local" | "world"`)
- [x] Limit velocity over lifetime
- [x] Inherit velocity
- [x] Lifetime by emitter speed
- [x] Color by speed (`colorBySpeed`)
- [x] Size by speed (`sizeBySpeed`)
- [x] Rotation by speed (`rotationBySpeed`)

### Collision

Start simple:

```ts
collision: {
  type: "plane",
  y: 0,
  bounce: 0.4,
  dampening: 0.6,
  killOnCollision: false,
}
```

Primitives now supported:

```ts
collision: {
  type: "sphere" | "box",
  center: [0, 1, 0],
  // sphere
  radius: 0.8,
  // box
  size: [1.6, 1.4, 1.6],
}
```

Later, optionally support Three.js raycast collisions:

```ts
collision: {
  type: "raycast",
  objects: [...],
}
```

### Sub-Emitters

Start with CPU-only sub-emitters:

```ts
subEmitters: {
  onBirth: "tinyFlash",
  onDeath: "sparkBurst",
  onCollision: "impactFlash",
}
```

Use cases:

- Projectile dies -> explosion
- Explosion particles die -> smoke
- Sparks hit floor -> tiny flash
- Magic orb expires -> ring burst

GPU sub-emitters should wait. Particle death happens on the GPU, and reading that back to the CPU is expensive and awkward.

### Stretched Billboards

Add renderer mode or options:

```ts
renderer: {
  type: "billboard" | "stretchedBillboard" | "trail",
  align: "camera" | "velocity",
  stretchBySpeed: true,
}
```

Use cases:

- Bullets
- Sparks
- Dash streaks
- Sword slashes
- Magic missiles

### Missing Gameplay-Oriented Motion Modules

These are high-value controls inspired by Unity’s module model and should stay preset-driven:

```ts
limitVelocityOverLifetime: {
  speed: 6,
  dampen: 0.25,
}

inheritVelocity: {
  factor: 0.5,
}

lifetimeByEmitterSpeed: {
  speedRange: [0, 12],
  lifetimeRange: [1.8, 0.4],
}

colorBySpeed: {
  speedRange: [0, 10],
  gradient: [[0, "#ffffff"], [1, "#ff6a22"]],
}

sizeBySpeed: {
  speedRange: [0, 10],
  curve: [[0, 0.6], [1, 1.2]],
}

rotationBySpeed: {
  speedRange: [0, 10],
  angularVelocity: [[0, 0], [1, 8]],
}
```

Notes:

- Keep these CPU-first initially.
- GPU support can follow once data plumbing/perf constraints are clear.


### Priority

High for CPU effects.

This is the “game juice” milestone.

## Milestone 3 — Big Ambient GPU Systems

Goal: make GPU particles reliable for large background and atmosphere effects.

### Features

- [ ] Better GPU spawn scheduling
- [ ] GPU emitter transform updates
- [x] GPU bounds controls (`bounds.center` / `bounds.radius`)
- [ ] GPU pause/resume/restart polish
- [x] Better noise (coherent FBM field + vortex-friendly controls)
- [ ] GPU texture atlas animation modes
- [x] Optional soft particles

### GPU Spawn Scheduling

Current GPU burst spawning works, but future versions should support multiple spawn commands per frame.

Potential design:

```ts
gpu: {
  maxSpawnCommandsPerFrame: 8,
}
```

Eventually, commands could be packed into a small texture or buffer:

```txt
command 0: startIndex, count, emitter transform, preset id
command 1: startIndex, count, emitter transform, preset id
...
```

Do not build this until needed.

### GPU Bounds

GPU systems should allow explicit bounds to avoid incorrect culling or massive bounding sphere recomputation.

```ts
bounds: {
  center: [0, 0, 0],
  radius: 20,
}
```

### Effects Unlocked

- Snowstorm
- Battlefield embers
- Magical arena fog
- Dust in sunbeams
- Firefly fields
- Rain volumes

### Priority

Medium-high.

This is the “make the world breathe” milestone.

## Milestone 4 — Rendering Polish

Goal: reduce visual artefacts and make effects feel integrated into the scene.

### Features

- Soft particles
- Premultiplied alpha option
- HDR-friendly additive intensity
- Colour intensity multiplier
- Distortion texture support
- Optional depth fade
- Render layers
- Composer integration helpers

### Soft Particles

For smoke, fog, water splashes, and floor dust, particles clipping into geometry can look cheap.

Proposed API:

```ts
renderer: {
  softParticles: true,
  softness: 1.5,
}
```

Requires access to a scene depth texture. This should be opt-in because it touches renderer/composer setup.

### Sorting Strategy

Do not aim for perfect sorting early.

Supported modes (CPU only, shipped in Milestone 2):

```ts
renderer: {
  sorting: "none" | "distance" | "youngestFirst" | "oldestFirst",
}
```

CPU sorts particles back-to-front by world-space camera distance by default. Age-based modes (`youngestFirst`, `oldestFirst`) place the named cohort on top.

GPU should mostly rely on:

- Additive blending
- Alpha blending with depth write off
- Soft particles
- Good particle textures

GPU sorting is not planned for the MVP; the field is ignored on the GPU backend.

### Priority

Medium.

This is the “not obviously homemade” milestone.

## Milestone 5 — Preset Composition And Authoring Tools

Goal: stop hand-writing every curve and duplicate preset by hand.

### Features

- [ ] Preset inheritance/composition
- [ ] Texture atlas helpers
- [x] Debug overlay and metrics
- [x] Debug gizmo expansion
- [ ] Visual editor prototype

### Preset Inheritance

Support effect inheritance/composition.

Possible fluent API:

```ts
const fireBase = defineParticlePreset({
  renderer: { blendMode: "additive" },
  forces: { drag: 1.2 },
});

const torchFire = fireBase.extend({
  emission: { rateOverTime: 80 },
});
```

Possible JSON-style API:

```ts
{
  extends: "baseSmoke",
  start: {
    size: [0.2, 0.8],
  },
}
```

### Texture Atlas Helpers

Current texture sheet support is mechanical. Improve ergonomics:

```ts
textureSheet: {
  frameSize: [128, 128],
  frameCount: 23,
  fps: 24,
  mode: "overLifetime" | "fps" | "random",
}
```

Texture loading helper:

```ts
loadParticleTexture("/particles/smoke.png", {
  srgb: true,
  premultiplyAlpha: true,
});
```

### Debug Tools

Minimum debug overlay:

```ts
particles.debug = true;
```

Should show:

- Emitter shapes
- Alive count
- Max particles
- Backend type
- Bounds
- Draw calls
- Approximate memory use

Debug gizmos:

```ts
showEmitterBounds: true
showSpawnDirection: true
```

### Visual Editor

Eventually build a browser-based editor that can:

- Preview presets
- Edit curves
- Edit gradients
- Choose emitter shape
- Preview emitter gizmos
- Export JSON/TypeScript presets
- Hot reload into the game

This is strategically important but not needed before the runtime is stable.

### Priority

Medium for preset composition and debug tools.
Later for full visual editor.

This is the “Unity Shuriken, but not cursed by committee” milestone.

## Milestone 6 — Trails And Ribbons

Goal: support effects that need continuity over time rather than independent billboard sprites.

### Features

- [ ] `renderer.type: "trail"`
- [ ] `renderer.type: "ribbon"`
- [ ] Trail API (`trail.length`, `trail.widthOverLifetime`)

### Renderer Modes

```ts
renderer: {
  type: "billboard" | "stretchedBillboard" | "trail" | "ribbon",
}
```

### Trail API

```ts
trail: {
  length: 12,
  widthOverLifetime: [
    [0, 1],
    [1, 0],
  ],
}
```

### Use Cases

- Bullets
- Sword slashes
- Magic missiles
- Fireball tails
- Dash effects
- Enemy movement streaks

### Priority

Medium-high for action games.

## Milestone 7 — WebGPU Backend

Goal: add a modern compute-oriented GPU backend once the Three.js WebGPU stack is stable enough for library use.

### Features

- [ ] WebGPU backend mode
- [ ] WebGL/WebGPU backend selection in GPU settings
- [ ] WebGPU parity pass for core GPU features

### Potential API

```ts
simulation: "webgpu"
```

or:

```ts
simulation: "gpu",
gpu: {
  backend: "webgl" | "webgpu",
}
```

### Benefits

- Compute shaders
- Storage buffers
- Cleaner particle state representation
- Better burst command buffers
- Potentially better GPU trail/ribbon support
- Less reliance on ping-pong render target tricks

### Warning

Do not make WebGPU the primary backend too early. The WebGL2-compatible backend is currently the safer reusable path.

### Priority

Later.

## Implementation Notes

### Backends Should Stay Hidden Behind A Common Interface

Recommended internal interface:

```ts
interface ParticleBackend {
  play(): void;
  pause(): void;
  stop(): void;
  restart(): void;
  emit(count: number): void;
  update(dt: number, camera: THREE.Camera): void;
  dispose(): void;

  readonly isAlive: boolean;
  readonly isPlaying: boolean;
  readonly isComplete: boolean;
  readonly elapsed: number;
  readonly aliveCount: number;
}
```

`ParticleSystem` should delegate to the backend:

```ts
class ParticleSystem extends THREE.Object3D {
  private backend: ParticleBackend;

  constructor(preset: ParticlePreset) {
    super();

    this.backend =
      preset.simulation === "gpu"
        ? new GPUParticleBackend(this, preset)
        : new CPUParticleBackend(this, preset);
  }

  update(dt: number, camera: THREE.Camera) {
    this.backend.update(dt, camera);
  }
}
```

### Keep CPU And GPU Feature Support Explicit

Not every feature should exist on every backend.

Examples:

```txt
CPU:
  collision
  sub-emitters
  particle death callbacks
  precise gameplay behaviour

GPU:
  huge particle counts
  continuous ambient effects
  cheap visual density
```

If a preset asks for a GPU-incompatible feature, options are:

1. Fall back to CPU in `simulation: "auto"`.
2. Warn in development mode.
3. Ignore unsupported fields only if safe.
4. Throw if `simulation: "gpu"` was explicitly requested and the feature cannot work.

### Preset Validation

Add validation for common mistakes:

- Negative lifetime
- `maxParticles <= 0`
- Unsupported emitter type
- GPU backend used without required renderer
- Texture sheet with invalid rows/columns
- Curves not sorted by time
- Gradient not sorted by time
- Unsupported backend/feature combination

### Auto Backend Selection

For `simulation: "auto"`, a future heuristic could be:

```txt
Use CPU if:
  maxParticles <= 2000
  collision is enabled
  subEmitters are enabled
  particle callbacks are enabled
  effect is one-shot and gameplay-facing

Use GPU if:
  maxParticles > 2000
  effect is looping/ambient
  no collision
  no subEmitters
  mostly visual-only
```

## Recommended Next Steps

Implement in this order:

```txt
1. (done) Real ParticleWorld pooling
2. (done) Better lifecycle API and aliveCount
3. (done) Preset validation
4. (done) CPU plane collision
5. (done) CPU sub-emitters (onBirth/onDeath/onCollision)
6. (done) Stretched billboard renderer
7. (done) CPU sorting (renderer.sorting)
8. (done) Debug stats and emitter gizmos
9. (done) Soft particles
10. Preset inheritance/composition
11. Texture atlas helpers
12. Visual editor prototype
13. WebGPU backend
14. (done) Limit velocity over lifetime
15. (done) Inherit velocity + lifetime by emitter speed
16. (done) Speed-driven authoring (`colorBySpeed`, `sizeBySpeed`, `rotationBySpeed`)
17. External force fields / triggers / particle lights / custom data (later)
```

This order gives the biggest visible improvement per unit of complexity.

## Design Rules

1. Keep the authoring API preset-driven.
2. Keep CPU and GPU backends behind a common interface.
3. Do not expose shader/render-target complexity to ordinary users.
4. Prefer additive/alpha-friendly visual design over expensive sorting.
5. Use CPU for precise gameplay effects.
6. Use GPU for large visual-only ambience.
7. Add debug tooling before adding too many advanced features.
8. Prefer composable presets over copy-pasted preset blobs.
9. Avoid Unity parity as a goal. Copy the useful mental model, not the entire cathedral.
10. Make the common case beautiful: `particles.spawn("effect", { position })`.

## Summary

The current library has a solid foundation:

- Shared preset model
- CPU backend for precise effects
- GPU backend for large visual effects
- Good enough ergonomics to start using in actual Three.js scenes

The next phase should focus on stability, preset validation, CPU collisions, sub-emitters, and authoring/debug tools.

The long-term prize is a Three.js-native particle system that feels as easy to use as Unity Shuriken, but remains lightweight, modular, and game-friendly.
