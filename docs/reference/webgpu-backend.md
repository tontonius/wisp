# WebGPU Backend Reference

The WebGPU backend is an experimental migration target for Three.js `WebGPURenderer`, TSL materials, and compute-driven particle simulation.

## Status

The backend selection API is available:

```ts
import "@tontonius/wisp/webgpu";

const preset: ParticlePreset = {
  simulation: "gpu",
  gpu: {
    backend: "webgpu",
  },
};
```

Current behavior:

- The core `@tontonius/wisp` entrypoint does not eagerly import `three/webgpu` or `three/tsl`.
- Import `@tontonius/wisp/webgpu` once before creating WebGPU particle systems. This secondary entrypoint registers the experimental WebGPU backend.
- If `gpu.backend: "webgpu"` resolves before the secondary entrypoint is imported, the system falls back to CPU and logs a warning.
- `gpu.backend: "webgpu"` requires a renderer with `isWebGPURenderer: true`.
- `gpu.backend: "auto"` resolves to WebGPU when a `WebGPURenderer` is passed.
- The current WebGPU backend uses a TSL `MeshBasicNodeMaterial` path in authoritative WebGPU mode.
- With WebGPU compute and storage-buffer readback available, v0 feeds billboard position through a narrow motion readback bridge, while CPU lifecycle bookkeeping writes render-state flags, display size, opacity, and rotation.
- The diagnostic `motionMode` is `"motion-readback-bridge"` for this authoritative path.
- If a WebGPU renderer exposes `compute` but not `getArrayBufferAsync`, v0 runs the compute pass as a sidecar diagnostic while rendering remains driven by the CPU mirror.
- The diagnostic `motionMode` is `"cpu-mirror"` for sidecar/unavailable fallback rendering.
- The CPU mirror remains temporarily for spawn metadata, lifecycle bookkeeping, color/opacity curves, and fallback rendering.
- If a WebGPU-like renderer does not expose `compute`, v0 keeps rendering from the CPU mirror and skips the sidecar compute pass.
- Validation logs a warning when a preset resolves to WebGPU.
- Production effects that need unsupported parity features should use CPU or `gpu.backend: "webgl"`.

## V0 Feature Slice

Implemented:

- Point, sphere, hemisphere, cone, and box emitter sampling.
- Continuous emission and scheduled bursts.
- `emit(count)`.
- Predictable wrapping spawn cursor semantics matching the WebGL GPU backend.
- Start lifetime, speed, velocity, size, color, opacity, rotation, and angular velocity.
- Constant acceleration, drag, and linear velocity over lifetime.
- Camera-facing instanced billboard rendering.
- TSL/node-material billboard rendering for authoritative WebGPU mode.
- Camera right/up uniforms for TSL billboards in authoritative WebGPU mode.
- Transformed object coverage for the TSL camera-basis path.
- Per-particle transparent opacity in the authoritative TSL path via `opacityNode`.
- Renderer texture, texture-sheet atlas UVs, `alphaFromLuminance`, blend mode, depth test/write, and explicit bounds.
- Storage buffers for position/age, velocity/lifetime, simulation state, and render state.
- Compute pass for age/kill, acceleration, drag, velocity/position integration, and spin.
- Storage-buffer-backed position, size, opacity, rotation, and texture-sheet frame nodes in authoritative WebGPU mode. Over-lifetime display size is kept separate from simulation start size so render curves do not mutate particle spawn state.
- Alive count and slot lifecycle tracking without reading active state back from the GPU.
- Per-buffer upload tracking so lifecycle deaths update active/render state without re-uploading stale CPU motion buffers over GPU-integrated positions.

## Supported Preset Fields

The WebGPU backend intentionally supports a smaller field slice than the WebGL backend while parity work is in progress.

Currently supported:

- Top-level lifecycle: `name`, `simulation`, `gpu.backend`, `gpu.maxSpawnPerFrame`, `maxParticles`, `duration`, `loop`, `prewarm`, `autoDispose`, `simulationSpace`, and `bounds`.
- Emitters: point, sphere, hemisphere, cone, and box emitter options.
- Emission: `rateOverTime` and scheduled `bursts`.
- Start values: `lifetime`, `speed`, `velocity`, `size`, `opacity`, `color`, `rotation`, and `angularVelocity`.
- Forces: constant `acceleration` and `drag`.
- Point attractor force: `forces.pointAttractor.center`, `strength`, `epsilon`, and `strengthOverLifetime`.
- Vortex force: `forces.vortex.center`, `axis`, `orbitalSpeed`, `inward`, and `upward`.
- Noise force: `forces.noise.strength`, `frequency`, `scroll`, `octaves`, `lacunarity`, and `persistence`.
- Velocity over lifetime: `velocityOverLifetime.linear`.
- Limit velocity over lifetime: `limitVelocityOverLifetime.speed` and `dampen`.
- Over lifetime: `size`, `opacity`, and `color`.
- Speed-driven modules: `colorBySpeed`, `sizeBySpeed`, and `rotationBySpeed`.
- Renderer: `texture`, `textureSheet`, `alphaFromLuminance`, `dispersal`, `softParticles`, `softness`, `blendMode`, `depthWrite`, `depthTest`, billboard rendering, `renderer.align: "velocity"`, and `renderer.type: "stretchedBillboard"` with `stretchFactor` / `stretchMaxScale`.

Unsupported WebGPU fields currently fall back only when the selected backend is not WebGPU; they are not WebGPU parity features yet. Keep production effects that need those modules on CPU or `gpu.backend: "webgl"`.

## Comparison Helper

Use `compareParticlePresetBackends(preset)` to inspect how the same preset resolves under CPU, WebGL, and WebGPU targets without constructing a live renderer. This is the helper used by the editor diagnostics backend matrix.

Each row includes the target, selected backend/fallback reason, validation errors/warnings, and compact `issueLabels` such as `experimental`, `sorting ignored`, or `fallback: collision`. It is intended for authoring tools and migration checks, not per-frame runtime use.

## Spawn Behavior

WebGPU v0 samples emitter and start values on the CPU, then writes the selected particle slot directly into the storage arrays used by compute and TSL rendering. Slot selection uses a wrapping cursor, matching the WebGL GPU backend:

- `emit(count)` writes at most `gpu.maxSpawnPerFrame` particles for that call.
- Spawns advance through slots from `0` to `maxParticles - 1`.
- When the cursor wraps, new particles overwrite old slots.
- `stop({ clear: true })` resets the cursor to `0`.

## Unsupported WebGPU Features

These options are accepted by the shared preset type but are not WebGPU parity features yet.

Renderer options:

- `renderer.sorting`.

Simulation and force modules:

- Collision.
- Sub-emitters.
- Mesh emitters.
- Trails/ribbons.
- Particle lights.
- CPU lifecycle callbacks such as `callbacks.onParticleDeath`.

Architecture gaps:

- Fully GPU-owned render metadata. V0 still uses CPU-derived color/opacity/size-over-life metadata.
- Fully GPU-owned motion rendering. V0 still uses a position/velocity motion readback bridge until storage-buffer-to-vertex sharing is proven reliable in the backend.
- Removing the CPU mirror. It still feeds spawn metadata, start color/opacity, lifecycle bookkeeping, and fallback rendering.

## Bundle Split

The experimental WebGPU backend lives behind the secondary `@tontonius/wisp/webgpu` entrypoint. CPU and WebGL users can import the core package without eagerly importing `three/webgpu` or `three/tsl`.

The current package emits:

- `dist/index.js`: core CPU/WebGL entrypoint.
- `dist/webgpu.js`: WebGPU registration entrypoint with the TSL backend implementation.

`dist/index.js` should not contain `three/tsl` or `three/webgpu` imports after `npm run build`.

## Initialization Note

Three.js `WebGPURenderer` setup is asynchronous in common app flows. Initialize the renderer before handing it to Wisp:

```ts
import "@tontonius/wisp/webgpu";

const renderer = new WebGPURenderer({ canvas });
await renderer.init();

const system = new ParticleSystem(preset, { renderer });
```

## Smoke Harness

Run the internal WebGPU smoke harness through Vite:

```bash
npm run dev
```

Then open:

```txt
http://localhost:5173/editor/webgpu-smoke.html
```

Expected result:

- The status panel reaches `ready`.
- The status panel shows `backend: webgpu`.
- The status panel shows `compute: authoritative` when WebGPU compute and storage-buffer readback are available, `compute: sidecar` when only compute is available, or `compute: unavailable` on renderer-like test objects without `compute`.
- The status panel shows `motion: motion-readback-bridge` for the current authoritative TSL smoke path.
- `alive` is greater than `0`.
- A looping additive particle plume is visible.
- Drag to orbit and use the mouse wheel to zoom; particles should keep facing the camera instead of turning edge-on.

The authoritative TSL billboard path has been human-verified in this harness with visible textured particles and stable over-lifetime sizing. Local Playwright screenshots have proven unreliable for WebGPU canvas output in this environment, so use browser-visible results for final visual checks.

If the status is `unsupported`, the browser does not expose `navigator.gpu`. Try a browser/version with WebGPU enabled.

## TSL Billboard Spike

There is also an internal standalone TSL billboard spike:

```txt
http://localhost:5173/editor/webgpu-tsl-billboard-spike.html
```

It does not use `ParticleSystem`. It renders a small cyan instanced billboard grid from storage-buffer attributes so the TSL draw path can be debugged before it is ported into the WebGPU backend.
