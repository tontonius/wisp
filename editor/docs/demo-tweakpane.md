# Demo Tweakpane Editor

Deprecated: the `demo/` app is no longer an active development surface. This page is retained for legacy reference only.

The demo in `demo/main.ts` includes a Tweakpane-based preset editor and debugging surface. This page documents those demo-only controls.

## Billboard Art (`demo/billboards/`)

On startup, `demo/main.ts` loads PNGs via `loadDemoBillboardTextures` from `demo/billboard-textures.ts` and passes them into `createDemoPresets` as `textures.billboards`. If loading fails (network, missing files), the demo logs a warning and presets fall back to the procedural disc textures.

Those PNGs are treated as **white (or light) art on black**: each bitmap is rasterized to a canvas, then near-black luminance is hard-cut to transparent while mid/high luminance keeps source alpha. This is intentionally a stronger matte cutoff than plain `alpha *= luminance/255` so dark background haze does not linger. True RGBA assets still work; premultiplied alpha is respected via the existing alpha channel.

| File | Layout (columns x rows) | Used by (when loaded) |
| --- | --- | --- |
| `smoke_puff.png` | Single image | `smokePuff` |
| `1x_4_smoke_puff_sheet.png` | 4 x 1 | `shockwaveCenterExplosion` (`textureSheet.animationMode: "randomStart"`) |
| `2x1_smoke_puffs.png` | 2 x 1 | Available via `demoBillboardUrls` / `DemoBillboardTextureSet.smokePuffsSheet2x1` for custom presets |
| `4x4_smoke_puffs.png` | 4 x 4 | `stylizedExplosion` (`textureSheet.animationMode: "randomStart"`) |
| `3x4_smoke_puff_dispersal.png` | 4 x 3 (from pixel grid) | `magicAuraGpu` (`textureSheet.animationMode: "overLifetime"`) |
| `leaves_sprite_sheet.png` | 4 x 1 | `tornadoDemo`, `autumnLeaves` |
| `snowflake_sprite_sheet.png` | 4 x 1 | `snowGpu` |
| `sunburst.png` | Single image | `shockwaveSunburst` (spawned with **Shockwave**) |

To reuse the same resolved URLs elsewhere (for example your own loader), import `demoBillboardUrls` from `demo/billboard-textures.ts` (built with `new URL(..., import.meta.url)` so Vite includes the files in the bundle).

## Scene Tab

Inside the main Tweakpane as a `Scene` tab next to `Particles` and `Camera`. Does not affect preset export.

| Control | Effect |
| --- | --- |
| `Ground plane` | Shows or hides the demo floor mesh and `GridHelper`. Pointer spawn still uses the mathematical ground plane at `y = 0` when the mesh is hidden. |
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
