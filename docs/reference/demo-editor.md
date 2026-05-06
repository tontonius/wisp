# Demo Editor Reference

The Wisp demo in `demo/main.ts` includes a Tweakpane editor for creating and copying `ParticlePreset` code.

## Visual Editor (alpha)

A separate visual-editor prototype now exists in `editor/` as an alternate authoring surface.

- Run with `npm run dev:editor`.
- Build with `npm run build:editor`.
- Open at `/editor/` during local Vite dev.

Current alpha capabilities:

- Tweakpane-driven controls and actions for all editor UI.
- Multiple panes (`Particle Editor`, `Preset JSON`, `Diagnostics`) similar to the demo workflow.
- Additional bottom-right `Debug` pane with a global on/off `Debug Gizmos` toggle (`wisp.particles.setDebug(...)`) for active and future systems.
- The `Debug` pane has a `Camera` section with `Auto orbit` and `Speed (deg/s)` controls, using an orbit camera around scene center.
- The `Debug` pane includes playback controls (`Play`, `Pause`, `Reset`) and a playback slider (`Playback (s)`) that tracks active system elapsed time, wraps/reset to `0` for looping effects, and dynamically uses the current preset `duration` as slider max. When paused, you can drag the slider to scrub time.
- Main editor uses API-mapped folders (for example `Particle System`, `Emission`, `Emitter`, `Start`, `Forces`, `Renderer`, and `Over Lifetime`).
- The `Start` folder includes start rotation controls (`start.rotation` and `start.angularVelocity`) as min/max ranges in radians and radians/sec.
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
- Live preview respawn on edit.
- Vanilla preset authoring flow (no built-in preset selector in the visual editor).
- Diagnostics pane includes an FPS graph and live runtime stats (`systems`, CPU/GPU split, alive/max totals, busiest system).
- JSON import/export actions through pane buttons.
- `Apply JSON` accepts multiple Wisp-style shapes: direct `ParticlePreset` JSON, wrappers like `{ "preset": { ... } }`, and collections/maps like `{ "effects": { "name": { ... } } }` (loads the first valid effect found).
- `Apply JSON` also accepts JS/TS-style object literals copied from source files (for example from `demo/presets.ts`: unquoted keys, trailing commas, single quotes).
- In the visual editor, `renderer.softParticles` now works because the editor runs an internal scene-depth prepass and syncs that depth texture into live systems each frame.

This editor is intentionally early-stage and does not replace the Tweakpane flow yet.

## URL parameters

| Query | Effect |
| --- | --- |
| `?pool=1` | Enables inactive pooling (`pooling: true`) so repeated one-shot spawns reuse GPU/CPU backends. |

## Billboard art (`demo/billboards/`)

On startup, `demo/main.ts` loads PNGs via `loadDemoBillboardTextures` from `demo/billboard-textures.ts` and passes them into `createDemoPresets` as `textures.billboards`. If loading fails (network, missing files), the demo logs a warning and presets fall back to the procedural disc textures.

Those PNGs are treated as **white (or light) art on black**: each bitmap is rasterized to a canvas, then near-black luminance is hard-cut to transparent while mid/high luminance keeps source alpha. This is intentionally a stronger matte cutoff than plain `alpha *= luminance/255` so dark background haze does not linger. True RGBA assets still work; premultiplied alpha is respected via the existing alpha channel.

| File | Layout (columns × rows) | Used by (when loaded) |
| --- | --- | --- |
| `smoke_puff.png` | Single image | `smokePuff` |
| `1x_4_smoke_puff_sheet.png` | 4 × 1 | `shockwaveCenterExplosion` (`textureSheet.animationMode: "randomStart"`) |
| `2x1_smoke_puffs.png` | 2 × 1 | Available via `demoBillboardUrls` / `DemoBillboardTextureSet.smokePuffsSheet2x1` for custom presets |
| `4x4_smoke_puffs.png` | 4 × 4 | `stylizedExplosion` (`textureSheet.animationMode: "randomStart"`) |
| `3x4_smoke_puff_dispersal.png` | 4 × 3 (from pixel grid) | `magicAuraGpu` (`textureSheet.animationMode: "overLifetime"`) |
| `leaves_sprite_sheet.png` | 4 × 1 | `tornadoDemo`, `autumnLeaves` |
| `snowflake_sprite_sheet.png` | 4 × 1 | `snowGpu` |
| `sunburst.png` | Single image | `shockwaveSunburst` (spawned with **Shockwave**) |

To reuse the same resolved URLs elsewhere (e.g. your own loader), import `demoBillboardUrls` from `demo/billboard-textures.ts` (built with `new URL(..., import.meta.url)` so Vite includes the files in the bundle).

## Scene Tab

Inside the main Tweakpane as a `Scene` tab next to `Particles` and `Camera`. Does not affect preset export.

| Control | Effect |
| --- | --- |
| `Ground plane` | Shows or hides the demo floor mesh and `GridHelper`. Pointer spawn still uses the mathematical ground plane at \(y = 0\) when the mesh is hidden. |
| `Ground color` | Color picker for the floor `MeshStandardMaterial` (does not change the grid line colors). |

## Camera Tab

Inside the main Tweakpane as a dedicated `Camera` tab. These controls are demo-only and do not affect particle preset export.

| Control | Effect |
| --- | --- |
| `enabled` | Master toggle for camera shake application. |
| `shake on spawn` | Applies trauma impulse whenever an effect is spawned in the demo. |
| `space key` | Allows triggering shake with the Space key (when focus is not on UI). |
| `trigger trauma` | Trauma amount used by manual triggers (button/key). |
| `decay` | Linear trauma decay speed in units/second. |
| `power` | Nonlinear trauma exponent (`trauma^power`) controlling low vs high intensity response. |
| `noise hz` | Temporal frequency of coherent shake noise. |
| `max pitch` / `max yaw` / `max roll` | Max rotational shake angle in degrees for each axis. |
| `Reset shake` | Clears trauma and restores baseline camera transform. |

## Capture Pane

Separate bottom-left Tweakpane used for recording-friendly camera motion. These controls are demo-only and do not affect exported presets.

| Control | Effect |
| --- | --- |
| `Orbit camera` | Toggles continuous camera orbit around the scene target. |
| `Orbit deg/s` | Constant angular speed in degrees per second (negative reverses direction). |
| `FPS` | Essentials plugin `fpsgraph` blade showing frame-time/fps trend. |
| `Runtime stats` | Read-only live summary of active particle systems (`systems`, CPU/GPU counts, total alive/max particles, busiest effect) plus a `camera trauma` graph over time. |
| `Playback` buttons (`Play`, `Pause`, `Restart`, `Stop`) | Applies the selected lifecycle action to all currently active systems in the demo particle manager. Useful for validating lifecycle behavior across CPU and GPU effects. |

## Controls Folder

| Control | Effect |
| --- | --- |
| `click` | Selects the effect spawned by pointer clicks and buttons (including **Speed visual (CPU)**, **Dash trail emitter (CPU world)** for `inheritVelocity` + `lifetimeByEmitterSpeed`, **Candy vortex**, **Blue flame (dispersal)** for `renderer.dispersal`, **Stylized explosion**, and **Shockwave** which spawns a ring + center blast + sunburst + shrapnel burst). |
| `Spawn at center` | Spawns the selected effect near the center of the scene. |
| `Load selected into editor` | Copies a built-in preset into the custom editor controls. |
| `Preview loop` | Spawns or respawns the custom effect as a loop preview. |
| `Clear systems` | Disposes all systems tracked by the demo particle manager. |
| `Copy preset code` | Copies exportable TypeScript preset code. |

## Particle System Folder

Maps to top-level preset fields:

| Control | Preset Field |
| --- | --- |
| `simulation` | `simulation` |
| `max particles` | `maxParticles` |
| `duration` | `duration` |
| `loop` | `loop` |
| `prewarm` | `prewarm` |
| `gpu spawn/frame` | `gpu.maxSpawnPerFrame` |
| `debug gizmos` | `debug` |
| `debug all` | Runtime `wisp.particles.setDebug` |
| `spawn direction` | `debug.spawnDirection` |
| `gizmo color` | `debug.color` |
| `start life min/max` | `start.lifetime` |
| `start speed min/max` | `start.speed` |
| `start size min/max` | `start.size` |
| `start alpha min/max` | `start.opacity` |
| `start color min/max` | `start.color` when color-over-lifetime is disabled |

## Emission Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `emission` is included. |
| `Burst` | `emission.bursts[0]` |
| `Rate` | `emission.rateOverTime` |
| `rate over time` | `emission.rateOverTime` |
| `burst min/max` | `emission.bursts[0].count` |

## Shape Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `emitter` is included. |
| `shape` | `emitter.type` |
| `emit from` | `emitter.emitFrom` for sphere/hemisphere. |
| `radius` | `emitter.radius` for sphere/hemisphere/cone. |
| `angle` | `emitter.angle` for cone. |
| `length` | `emitter.length` for cone. |
| `box x/y/z` | `emitter.size` for box. |

## Start Velocity Folder

This is the old velocity-spread module. It maps to `start.velocity`, not `velocityOverLifetime`.

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `start.velocity` is included. |
| `x spread` | Min/max X range around zero. |
| `y min` | Minimum Y velocity. |
| `y max` | Maximum Y velocity. |
| `z spread` | Min/max Z range around zero. |

Generated shape:

```ts
start: {
  velocity: [[-xSpread, yMin, -zSpread], [xSpread, yMax, zSpread]]
}
```

## Velocity Over Lifetime Folder

This maps to the real per-age velocity module.

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `velocityOverLifetime` is included. |
| `linear x start/end` | `velocityOverLifetime.linear.x` |
| `linear y start/end` | `velocityOverLifetime.linear.y` |
| `linear z start/end` | `velocityOverLifetime.linear.z` |

Generated shape:

```ts
velocityOverLifetime: {
  linear: {
    x: [[0, xStart], [1, xEnd]],
    y: [[0, yStart], [1, yEnd]],
    z: [[0, zStart], [1, zEnd]],
  },
}
```

## Force Over Lifetime Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `forces` is included. |
| `acceleration x` | `forces.acceleration[0]` |
| `acceleration y` | `forces.acceleration[1]` |
| `acceleration z` | `forces.acceleration[2]` |
| `drag` | `forces.drag` |

## Vortex Folder

| Control | Preset Field |
| --- | --- |
| `center x/y/z` | `forces.vortex.center` |
| `axis x/y/z` | `forces.vortex.axis` |
| `orbital` | `forces.vortex.orbitalSpeed` |
| `inward` | `forces.vortex.inward` |
| `upward` | `forces.vortex.upward` |

Behavior (axis normalization, how values combine with acceleration and noise, near-axis edge case): see [Forces reference — Vortex](forces.md#vortex).

## Limit Velocity Over Lifetime Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `limitVelocityOverLifetime` is included. |
| `speed at birth` | `limitVelocityOverLifetime.speed[0][1]` |
| `speed at death` | `limitVelocityOverLifetime.speed[1][1]` |
| `dampen` | `limitVelocityOverLifetime.dampen` |

## Noise Folder

| Control | Preset Field |
| --- | --- |
| `strength` | `forces.noise.strength` |
| `frequency` | `forces.noise.frequency` |
| `scroll x/y/z` | `forces.noise.scroll` |
| `octaves` | `forces.noise.octaves` |
| `lacunarity` | `forces.noise.lacunarity` |
| `persistence` | `forces.noise.persistence` |

## Color Over Lifetime Folder

| Control | Preset Field |
| --- | --- |
| `color gradient enabled` | Whether `overLifetime.color` is included. |
| `gradient` | Combined color + opacity stop editor. Color stops map to `overLifetime.color`; opacity stops map to `overLifetime.opacity`. |

Gradient editor interactions:

- **Presets** (collapsible block under the editor): a grid of one-click swatches (starter ramps plus **Demo: …** entries copied from `demo/presets.ts` lifetime color + opacity). Choosing a preset replaces the current color and opacity stops and loads that ramp into the main strip.
- Drag a stop to move it.
- Double-click on the color row or gradient bar to add a color stop.
- Double-click on the opacity row to add an opacity stop.
- Select a stop, then use `Delete`/`Backspace` to remove it (minimum two stops per row).

When color-over-lifetime is enabled, the demo sets `start.color` to white so the gradient stops own the visible color.

## Size Over Lifetime Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `overLifetime.size` is included. |
| `end size` | Final size multiplier. |

The demo generates a simple three-stop curve:

```ts
size: [[0, 0], [0.18, 1], [1, grow]]
```

## Rotation Folder

| Control | Preset Field |
| --- | --- |
| `start min/max deg` | `start.rotation`, converted to radians. |
| `enabled` | Whether `start.angularVelocity` uses the range. |
| `angular min/max rad/s` | `start.angularVelocity` |

## Color by speed Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `colorBySpeed` is included. |
| `speed min` / `speed max` | `colorBySpeed.speedRange` |
| `gradient` | `colorBySpeed.gradient` (color stops only; opacity stops in the gradient UI are not exported to this preset field). |

See [Speed-driven modules](speed-driven.md).

## Size by speed Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `sizeBySpeed` is included. |
| `speed min` / `speed max` | `sizeBySpeed.speedRange` |
| `mult at low speed` | `sizeBySpeed.curve` first keyframe value (`t = 0`). |
| `mult at high speed` | `sizeBySpeed.curve` last keyframe value (`t = 1`). |

The demo generates a two-point curve `[[0, multLow], [1, multHigh]]`.

## Rotation by speed Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `rotationBySpeed` is included. |
| `speed min` / `speed max` | `rotationBySpeed.speedRange` |
| `rad/s at low speed` | `rotationBySpeed.angularVelocity` first keyframe value (`t = 0`). |
| `rad/s at high speed` | `rotationBySpeed.angularVelocity` last keyframe value (`t = 1`). |

The demo generates a two-point curve. Loading a preset with more than two keyframes uses the first and last values for the sliders.

## Renderer Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `renderer` is included. |
| `texture` | Demo texture selection. |
| `image alpha` | Demo-only preprocessing for custom images. |
| `blend` | `renderer.blendMode` |
| `align` | `renderer.align` |
| `sort` | `renderer.sorting` (CPU-only; ignored on the GPU backend). |
| `soft particles` | `renderer.softParticles` |
| `softness` | `renderer.softness` |

Soft particles in the demo:

- The demo runs an internal depth prepass each frame (without particle meshes) and automatically wires that depth texture into live systems.
- You can toggle soft particles per edited preset with `soft particles`; `softness` controls fade strength.

## Texture Sheet Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `renderer.textureSheet` is included. |
| `cols` | `textureSheet.columns` |
| `rows` | `textureSheet.rows` |
| `mode` | `textureSheet.animationMode` |

## Custom Image Loading

`Load billboard image` opens a local file input. The demo creates a `THREE.CanvasTexture`.

If `image alpha` is enabled, near-black luminance is hard-cut to transparent while mid/high luminance keeps source alpha. This makes white-on-black sprites key out cleanly without over-fading dark grays.

