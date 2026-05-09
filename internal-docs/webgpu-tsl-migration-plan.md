# WebGPU + TSL Migration Plan (Revised)

## Overview

Migrate Wisp's GPU path toward `WebGPURenderer` + TSL + compute, while preserving compatibility and keeping one stable public API.

The key principle is **additive migration, not replacement**:

- Keep CPU backend unchanged.
- Keep existing WebGL GPU backend supported.
- Add WebGPU GPU backend behind explicit backend selection.
- Keep public `simulation: "gpu"` stable.

## Strategic Direction

- **Do not drop WebGL support yet.** `WebGLRenderer` users should continue to work with both CPU and WebGL GPU paths.
- **Split "GPU concept" from implementation details.** Use explicit backend names (`webgl`, `webgpu`) under a shared GPU mode.
- **Roll out WebGPU in stages.** Ship a minimal, usable backend first; follow with parity in batches.
- **Treat trails as a post-migration spike.** `makio-meshline` remains promising but non-blocking.

## Public API Direction

Keep simulation mode stable:

```ts
simulation: "cpu" | "gpu" | "auto"
```

Add backend selection under GPU config:

```ts
gpu: {
  backend?: "auto" | "webgl" | "webgpu";
}
```

Resolution behavior target:

- `WebGLRenderer` user:
  - CPU backend works.
  - `gpu.backend: "webgl"` works.
  - `gpu.backend: "auto"` resolves to WebGL GPU path.
- `WebGPURenderer` user:
  - CPU backend works.
  - `gpu.backend: "webgpu"` preferred.
  - `gpu.backend: "auto"` resolves to WebGPU GPU path.

## Naming and Architecture

### Rename first

- Rename `src/particles/backends/gpu-backend.ts` to `src/particles/backends/webgl-backend.ts`.
- Add `src/particles/backends/webgpu-backend.ts`.
- Update internal naming (`WebGLParticleBackend`, `WebGPUParticleBackend`) so architecture matches behavior.

### Renderer abstraction

Introduce/expand a renderer capability layer so public APIs do not hardcode one renderer class prematurely. This isolates backend selection and capability checks from user-facing types.

## Migration Phases

1. **Renderer + backend abstraction**
   - Add backend selection (`gpu.backend`).
   - Detect renderer/runtime capability for `auto`.
   - Document async `WebGPURenderer` initialization where needed.

2. **Backend split without behavior change**
   - Rename existing GPU backend to `webgl-backend`.
   - Keep it first-class and supported.
   - Add `webgpu-backend` skeleton and wiring.

3. **Minimal WebGPU backend (v0)**
   - Storage buffers for position, velocity, life, and active state.
   - Compute pass for aging and velocity/position integration.
   - Basic billboard rendering via TSL node material.
   - Core emission path (including burst support).
   - Start size/color/opacity and over-lifetime size/color/opacity.
   - Bounds handling.

4. **Feature parity in batches**
   - **Batch 1:** acceleration, drag, bounds hardening, `simulationSpace`.
   - **Batch 2:** texture sheets, blend modes, `alphaFromLuminance`.
     - Texture sheets, blend modes, and `alphaFromLuminance` are now covered for the authoritative TSL billboard slice.
   - **Batch 3:** `colorBySpeed`, `sizeBySpeed`, `rotationBySpeed`.
   - **Batch 4:** noise, vortex, point attractor.
   - **Batch 5:** soft particles, dispersal.
   - **Batch 6:** stretched billboards / velocity alignment (feasibility-gated).

5. **Editor migration (after backend is proven)**
   - Add a WebGPU mode/harness first.
   - Validate presets in CPU/WebGL/WebGPU comparisons.
   - Migrate editor default only after WebGPU backend is stable enough for day-to-day authoring.

6. **Documentation and release cadence**
   - Keep docs in lockstep with each batch.
   - Publish staged versions:
     - `0.3.0`: WebGPU backend experimental.
     - `0.4.0`: WebGPU backend usable.
     - `0.5.0`: WebGPU preferred for `WebGPURenderer` users.
     - `1.0.0`: stable public API, docs, editor workflow, and tested backend story.

7. **Trail spike (`makio-meshline`)**
   - Run a technical spike after WebGPU backend maturity.
   - Validate storage-buffer handoff to meshline GPU hooks.
   - Ship `renderer.type = "trail"` only if ring-buffer ownership, instancing, and fallback behavior are proven.

## Files Affected (Planned)

### Backend/core

- `src/particles/backends/webgl-backend.ts` (renamed from current GPU backend, retained)
- `src/particles/backends/webgpu-backend.ts` (new)
- `src/particles/system.ts` (backend selection + auto resolution)
- `src/particles/types.ts` (public `gpu.backend` config)
- `src/wisp.ts` (renderer handling via abstraction)
- `src/particle-preset-validation.ts` (backend-specific validation messaging)

### Editor

- `editor/scene/viewport.ts` (WebGPU mode when phase-ready)
- `editor/panel-runtime.ts` (renderer/backend wiring)
- `editor/panels/particle-editor-pane.ts` (backend visibility/controls as needed)

### Docs

- `docs/explanation/rendering-stack.md`
- `docs/how-to/choose-a-backend.md`
- `docs/how-to/migrate-to-webgpu.md`
- `docs/reference/webgpu-backend.md`
- `README.md` roadmap/checklist updates per milestone

## Risks and Mitigations

- **WebGPU/TSL API churn across Three.js minors**
  - Pin dev versions and upgrade intentionally.
- **Different behavior across native WebGPU and fallback paths**
  - Test native WebGPU and fallback matrices explicitly.
- **Parity scope can sprawl**
  - Enforce batch shipping and milestone gates.
- **Trail integration uncertainty**
  - Keep MeshLine work as an isolated spike until data-path viability is proven.

## Explicit Non-Goals (Current Cycle)

- Deleting WebGL GPU backend.
- Forcing all users onto `WebGPURenderer`.
- Large CPU backend refactor.
- Broad editor redesign unrelated to backend migration.
- New demo-surface feature work in deprecated `demo/`.

## Task Checklist

- [x] Add renderer/backend abstraction and `gpu.backend: "auto" | "webgl" | "webgpu"`.
  - Added renderer capability helpers and backend auto-resolution.
  - Added `ParticleRenderer`, `WebGPURendererLike`, `GpuBackendPreference`, and `ResolvedGpuBackend` public types.
  - Added `ParticleSystem.gpuBackendType` for resolved GPU implementation introspection.
- [x] Rename existing `gpu-backend` to `webgl-backend` and keep support.
  - Existing render-target GPU path is now `WebGLParticleBackend`.
- [x] Add `webgpu-backend` skeleton and wire selection logic.
  - Added `WebGPUParticleBackend`.
  - Explicit WebGPU selection currently warns because v0 is experimental while the direct TSL draw path is still pending.
  - Added validation coverage for backend names and WebGL/WebGPU renderer mismatches.
- [ ] Ship minimal WebGPU backend (`0.3.0` experimental).
  - [x] V0 visible path: instanced billboards under `WebGPURenderer`.
  - [x] Internal WebGPU smoke harness at `/editor/webgpu-smoke.html`.
  - [x] Basic continuous emission, bursts, `emit(count)`, lifetime aging, velocity/position integration, start values, acceleration/drag, velocity over lifetime, and bounds.
  - [x] Storage buffers for position, velocity, life, and active state.
  - [x] Compute pass for aging and velocity/position integration.
  - [x] Fallback path when renderer-like WebGPU objects do not expose `compute`.
  - [x] Make storage-buffer compute authoritative for rendering through TSL storage attributes.
    - [x] Add a GPU-to-render data path so instance transforms/colors are derived from storage buffers, not the CPU particle mirror.
    - [x] Decide whether the first authoritative step uses GPU readback into the existing instanced mesh or jumps directly to TSL vertex expansion.
      - Chose TSL vertex expansion with a narrow position/velocity motion readback bridge. Removing all motion readback made the smoke test collapse into a spawn-point blob, so full storage-buffer-to-vertex sharing remains a later hardening step.
      - User-verified `/editor/webgpu-smoke.html` rises/spreads again after restoring the narrow motion readback bridge.
    - [x] Keep the smoke harness visually equivalent before/after the switch.
    - [x] Add debug/status text in the smoke harness for `compute: sidecar | authoritative | unavailable`.
    - [x] Remove duplicate CPU integration from WebGPU update once rendering no longer depends on CPU-updated particle positions.
  - [x] Basic billboard rendering via TSL node material.
    - [x] Isolate a minimal standalone WebGPU/TSL instanced billboard outside `ParticleSystem`.
      - Added `/editor/webgpu-tsl-billboard-spike.html`.
      - User-verified visible cyan billboard grid; local Playwright screenshots were unreliable for WebGPU canvas pixels in this environment.
    - [x] Replace `MeshBasicMaterial` instancing with a TSL/node material that samples particle storage buffers.
      - Ported the spike pattern into `WebGPUParticleBackend` for authoritative WebGPU mode.
      - Split render-state size from simulation start size after browser testing showed particles shrinking to invisibility in a few frames.
      - User-verified `/editor/webgpu-smoke.html` after the render-state fix: visible textured particles, `backend: webgpu`, `compute: authoritative`.
    - [x] Expand billboards in the vertex node from camera right/up vectors and per-particle size/rotation.
      - Current slice expands in local XY like the standalone spike; camera-facing basis uniforms remain a follow-up if non-camera-aligned behavior appears in scene transforms.
    - [x] Pass camera basis uniforms or derive camera-facing axes safely in TSL.
      - Camera right/up basis uniforms are wired into the TSL billboard node and user-verified in `/editor/webgpu-smoke.html` with orbit controls.
    - [x] Preserve texture sampling, blend mode, depth test/write, and additive smoke harness appearance.
    - [x] Confirm per-particle opacity can affect alpha instead of only darkening instance color.
      - Wired through `MeshBasicNodeMaterial.opacityNode` and user-verified in `/editor/webgpu-smoke.html`.
    - Note: first in-backend attempts with `SpriteNodeMaterial` and explicit `MeshBasicNodeMaterial.positionNode` looked blank in local Playwright screenshots, but the standalone TSL spike was user-verified in a real browser. Do not trust local WebGPU screenshots for visual confirmation.
  - [ ] Move spawn uploads into a dedicated GPU spawn/update path.
    - [x] Keep CPU sampling for emitter/start randomization initially.
    - [x] Upload spawned particle slots into storage buffers predictably after `emit(count)` and scheduled bursts.
      - WebGPU now uses a wrapping spawn cursor matching WebGL GPU slot semantics; spawned slots are written directly into storage arrays and marked for upload.
    - [x] Track active count/slot reuse without GPU readback in the hot path.
      - Authoritative WebGPU now advances CPU lifecycle state for age, alive/dead slots, rotation, alive count, and render-state metadata without reading active state back from the GPU.
      - Motion readback remains limited to position/velocity; per-buffer upload flags prevent lifecycle deaths from re-uploading stale CPU motion buffers over GPU-integrated positions.
      - Exposed as `system.motionMode` and the smoke harness `motion:` row; current authoritative mode reports `motion-readback-bridge`.
    - [x] Decide whether slot cursor behavior should match WebGL GPU exactly before parity work.
  - [x] Add smoke/verification coverage for the authoritative compute path.
    - [x] Add Playwright check for `/editor/webgpu-smoke.html` behind WebGPU-capable browser flags.
      - Added `tests/e2e/webgpu-smoke.spec.ts`, skipped unless `WISP_WEBGPU_E2E=1`.
    - [x] Capture status object fields: backend, alive count, compute mode, motion mode, no console/page errors.
    - [x] Add a visual nonblank/canvas-pixel check if the browser environment is reliable enough.
      - Manual Playwright smoke captured a non-empty canvas screenshot byte payload; this is not yet committed as an automated e2e test.
    - [x] Keep unit tests for renderer-without-compute fallback.
    - [x] Add unit coverage for authoritative TSL mode and no-readback lifecycle tracking.
  - [ ] Update WebGPU docs once compute becomes authoritative.
    - [x] Replace the blanket "sidecar compute" caveat with the authoritative TSL behavior and sidecar fallback.
    - [x] Correct docs/plan to state that direct TSL billboard rendering is still pending after the first spike.
    - [x] Document current supported WebGPU preset fields separately from WebGL GPU fields.
    - [x] Keep unsupported feature caveats explicit.
- [ ] Split or lazy-load WebGPU/TSL code so CPU/WebGL users do not pay the experimental TSL bundle cost.
  - [ ] Measure current `dist/index.js` size impact from importing `three/tsl`.
  - [ ] Choose one approach: dynamic import the WebGPU backend, secondary export, or accept size until `0.3.0` experimental.
  - [ ] Verify CPU/WebGL import path does not eagerly pull TSL after the split.
  - [ ] Document any async implications if backend loading becomes dynamic.
- [ ] Port parity feature batches through `0.4.0` and `0.5.0`.
  - [ ] Batch 1: acceleration, drag, bounds hardening, `simulationSpace`.
  - [x] Batch 2: texture sheets, blend modes, `alphaFromLuminance`.
    - [x] Texture-sheet atlas UVs for authoritative WebGPU TSL billboards.
    - [x] Preserve blend-mode material wiring in the TSL billboard path.
    - [x] `alphaFromLuminance`.
  - [x] Batch 3: `colorBySpeed`, `sizeBySpeed`, `rotationBySpeed`.
    - [x] `colorBySpeed` render tint in the authoritative TSL path and CPU-mirror fallback.
    - [x] `sizeBySpeed` display-size multiplier in the authoritative TSL path and CPU-mirror fallback.
    - [x] `rotationBySpeed` display spin rate in the authoritative TSL path and CPU-mirror fallback.
  - [x] Batch 4: noise, vortex, point attractor.
    - [x] Constant point-attractor force (`center`, `strength`, `epsilon`) in WebGPU compute and CPU-mirror fallback.
    - [x] `pointAttractor.strengthOverLifetime` in authoritative WebGPU compute.
    - [x] Vortex force in WebGPU compute and CPU-mirror fallback.
    - [x] Noise force in WebGPU compute and CPU-mirror fallback.
  - [x] Batch 5: soft particles, dispersal.
    - [x] Procedural dispersal in authoritative WebGPU TSL billboards.
    - [x] `dispersal.texture` map sampling.
    - [x] Soft particles / depth fade in authoritative WebGPU TSL billboards.
  - [x] Batch 6: stretched billboards / velocity alignment feasibility check.
    - [x] `renderer.align: "velocity"` in authoritative WebGPU TSL billboards and CPU-mirror fallback.
    - [x] `renderer.type: "stretchedBillboard"` with `stretchFactor` / `stretchMaxScale`.
    - [x] Smoke harness set to stretched velocity billboards for visual verification.
- [ ] Add editor WebGPU mode after backend stabilization.
  - [ ] Add renderer/backend selector in an internal editor/harness mode first.
  - [ ] Reuse the smoke harness status model for editor diagnostics.
  - [ ] Validate representative presets in CPU/WebGL/WebGPU comparisons.
  - [ ] Do not change the editor default renderer until WebGPU is stable for day-to-day authoring.
- [x] Keep docs and README roadmap/checklists updated for the backend selection/skeleton milestone.
  - Updated GPU/backend selection docs, API reference, preset validation docs, README, ROADMAP, and added `docs/reference/webgpu-backend.md`.
- [ ] Keep docs and README roadmap/checklists updated for future WebGPU implementation milestones.
- [ ] Run MeshLine trail spike only after backend maturity gates pass.
- [ ] Evaluate `1.0.0` only when API stability + docs + test coverage criteria are met.
