# Visual Editor (alpha)

The visual editor in `editor/` is an alternate authoring surface for Wisp effects.

- Run with `npm run dev:editor`.
- Build with `npm run build:editor`.
- Open at `/editor/` during local Vite dev.

## Source Layout

```txt
editor/
  main.ts               # thin entrypoint; calls startEditor()
  start-editor.ts       # bootstrap + tick loop wiring
  panel-runtime.ts      # shared runtime object consumed by panes
  types.ts              # shared editor scalar tuple types
  lib/                  # pure helpers (curves, gradients, textures, preset io)
  state/                # params, layer model, sync/apply bridge, export mapping
  scene/                # viewport/camera setup + emitter movement updates
  panels/               # scene/layers/editor/diagnostics/debug panes
```

When adding or changing editor controls, prefer `editor/panels/particle-editor-pane.ts` for UI bindings and visibility logic, and keep preset translation behavior in `editor/state/preset-bridge.ts`.

## Current Capabilities

- Tweakpane-driven controls and actions for all editor UI.
- Multiple panes (`Scene`, `Layers`, `Particle Editor`, `Diagnostics`, `Debug`) similar to the demo workflow; `Export` and `Import` are tabs inside the top-right `Layers` pane.
- A dedicated `Camera FX` pane is docked to the right of `Particle Editor` for camera shake tweaking and preview.
- Additional bottom-right `Debug` pane with a global on/off `Debug Gizmos` toggle (`wisp.particles.setDebug(...)`) for active and future systems.
- The `Debug` pane has a `Camera` section with `Auto orbit` and `Speed (deg/s)` controls, using an orbit camera around scene center.
- The `Scene` pane (docked left of `Layers`) includes `Ground Plane` visibility, `Ground Color`, `Background`, and a `Fog` subfolder with `Enabled`, `Color`, and `Near/Far` controls for preview-only scene tuning.
- The `Scene` pane includes `Editor View` with `Particles` and `Motion Test` modes.
- `Motion Test` is an isolated preview mode with a single cube driven by Wisp Motion effects (hover/breathe/pop loop) for quick tuning and visual checks.
- `Particles` mode keeps existing particle preview behavior unchanged; switching modes avoids cross-interference by running the relevant update path only.
- A dedicated `Motion` pane provides toggles for looped effects (`Hover`, `Breathe`, `Lean by velocity`, `Auto pop`) and one-shot action buttons (`Pop`, `Squash`, `Recoil`) for direct interaction testing.
- The `Debug` pane has a `Movement` section with `Enabled` and `Mode`; `circleLinear` moves active emitters in a circular path to preview effects on moving objects.
- The `Layers` pane supports multi-effect composition in one editor session: one folder per layer, opening/clicking a folder selects that layer for parameter editing, with `Name`, `Muted`, `Solo`, `Offset`, and `Emitter XYZ` controls plus in-folder `Clone`/`Delete` action buttons.
- A `New effect` button appears below each layer folder and adds a fresh default particle effect layer.
- Layer folder titles append `(M)` when muted and `(S)` when soloed.
- Each layer has an `Events` subfolder with `On Birth`, `On Death`, and `On Collision` target-layer dropdowns; muted layers can still be selected as child targets.
- In editor preview, these event links are mapped to runtime `subEmitters` (`onBirth`, `onDeath`, `onCollision`) using layer IDs, matching the demo/runtime sub-emitter flow. Note: sub-emitters are CPU-only.
- `Particle Editor` controls always edit the currently selected layer from the `Layers` pane.
- The `Debug` pane includes playback controls (`Play`, `Pause`, `Reset`) and a playback slider (`Playback (s)`) that tracks the selected layer elapsed time, wraps/reset to `0` for looping effects, and dynamically uses the selected layer `duration` as slider max. Playback buttons act on all currently active (non-muted / solo-filtered) layers.
- The `Camera FX` pane includes `Camera shake` controls (`Enabled`, `On respawn`, `Trigger trauma`, decay/power/noise, mode, rotation/translation limits), plus `Shake camera`, `Reset shake`, and live trauma graph preview.
- The `Debug` pane includes `Playback Speed` (`0..2`) to time-scale simulation `dt` for previewing effects in slow motion or faster-than-real-time.
- Main editor uses API-mapped folders (for example `Particle System`, `Emission`, `Emitter`, `Start`, `Forces`, `Renderer`, and `Over Lifetime`).
- The `Particle System` folder includes a `GPU Backend` selector (`auto`, `webgl`, `webgpu`) that writes `preset.gpu.backend`. The editor still uses its current viewport renderer; use Diagnostics to confirm which backend actually resolved.
- Add `?renderer=webgpu` (or `?webgpu=1`) to the editor URL to boot the viewport with Three.js `WebGPURenderer`. The default editor URL continues to use WebGL.
- Diagnostics runtime stats split active systems into CPU, WebGL GPU, and WebGPU GPU counts.
- The `Start` folder includes start rotation controls (`start.rotation` and `start.angularVelocity`) as min/max ranges in radians and radians/sec.
- The `Start` folder also exposes `start.velocity` as `Velocity Min`/`Velocity Max` (Vec3) for directional launch offsets beyond scalar `start.speed`.
- `Renderer` is organized by intent-first subfolders (`Render Style`, `Compositing`, `Depth`, `Texture Processing`, `Texture Sheet`) with conditional controls for stretched billboards, soft particles, luminance alpha keying, and texture-sheet animation.
- `Renderer > Texture Sheet` supports drag-and-drop (and click-to-browse) for custom atlas textures, including a live sheet preview and a `Clear Sheet Texture` action.
- `Dispersal` is exposed as its own top-level folder in the visual editor (still mapped to `renderer.dispersal`) with `Enabled`, `Strength`, `Amount`, `Noise Scale`, `Edge Softness`, and `Scroll`.
- `Dispersal` includes `Start At` (`0..1`) to delay dissolve onset over normalized lifetime; the editor maps this to a three-key amount curve (`[0, start] -> [startAt, start] -> [1, end]`).
- The `Dispersal` folder includes a drag-and-drop dropzone (plus click-to-browse) for loading a custom image as `renderer.dispersal.texture`, and a `Clear Texture` action to revert to built-in procedural noise.
- The `Dispersal` folder also includes a live `Mask Preview` panel: it shows the imported texture when present, or the generated procedural noise preview when no texture is loaded.
- Imported `Dispersal` textures are sampled centered in each particle sprite (not random phase-shifted per particle), which is friendlier for non-tileable round masks.
- Visual editor baseline defaults now start with `start.size: [1, 1]` and `renderer.texture: hardDisc`.
- Vector-like controls via Tweakpane point bindings for `Vec3` style fields.
- Essentials plugin cubic-bezier control mapped to over-lifetime size shaping.
- Live preview respawn on edit, with all active layers respawned together.
- Multi-layer authoring flow with selected-layer editing in the visual editor.
- Diagnostics pane includes an FPS graph and live runtime stats (`systems`, CPU/GPU split, alive/max totals, busiest system).
- Export actions through pane buttons.
- `Export` includes a multiline `Wisp effects JSON` textarea (copy/export only), containing all session layers as:
  - `{ "effects": { "<effectKey>": <ParticlePreset>, ... } }`
  - muted/child-only layers are included
  - per-layer event links are converted to exported effect-key sub-emitters
- `Import` includes a multiline `Wisp effects JSON` textarea where pasted `{ "effects": ... }` payloads can be applied into the active editor session.
- Import supports multiple layers in a single payload and restores `subEmitters` links between imported layers by resolving effect keys from the payload.
- Import sanitizes serialized texture placeholders/objects (for example `"[Texture:...]"`) by removing non-live texture references and reporting warnings in the import status.
- In the visual editor, `renderer.softParticles` now works because the editor runs an internal scene-depth prepass and syncs that depth texture into live systems each frame.

This editor is intentionally early-stage and does not replace the demo Tweakpane flow yet.

## URL Parameters

| Query | Effect |
| --- | --- |
| `?pool=1` | Enables inactive pooling (`pooling: true`) so repeated one-shot spawns reuse GPU/CPU backends. |
