# Demo Editor Reference

The demo in `demo/main.ts` includes a Tweakpane editor for creating and copying `ParticlePreset` code.

## URL parameters

| Query | Effect |
| --- | --- |
| `?pool=1` | Enables `ParticleWorld` inactive pooling (`pooling: true`) so repeated one-shot spawns reuse GPU/CPU backends. |

## Billboard art (`demo/billboards/`)

On startup, `demo/main.ts` loads PNGs via `loadDemoBillboardTextures` from `demo/billboard-textures.ts` and passes them into `createDemoPresets` as `textures.billboards`. If loading fails (network, missing files), the demo logs a warning and presets fall back to the procedural disc textures.

Those PNGs are treated as **white (or light) art on black**: each bitmap is rasterized to a canvas and **alpha is derived from luminance** (`alpha *= luminance/255`), matching the Tweakpane custom image option “alpha from luminance” in `main.ts`. True RGBA assets still work; premultiplied alpha is respected via the existing alpha channel in that formula.

| File | Layout (columns × rows) | Used by (when loaded) |
| --- | --- | --- |
| `smoke_puff.png` | Single image | `smokePuff` |
| `1x_4_smoke_puff_sheet.png` | 4 × 1 | `shockwaveCenterExplosion` (`textureSheet.randomFrame`) |
| `3x4_smoke_puff_dispersal.png` | 4 × 3 (from pixel grid) | `magicAuraGpu` (`textureSheet.randomFrame`) |
| `leaves_sprite_sheet.png` | 4 × 1 | `tornadoDemo` |
| `snowflake_sprite_sheet.png` | 4 × 1 | `snowGpu` |

To reuse the same resolved URLs elsewhere (e.g. your own loader), import `demoBillboardUrls` from `demo/billboard-textures.ts` (built with `new URL(..., import.meta.url)` so Vite includes the files in the bundle).

## Scene Tab

Inside the main Tweakpane as a `Scene` tab next to `Particles`. Does not affect preset export.

| Control | Effect |
| --- | --- |
| `Ground plane` | Shows or hides the demo floor mesh and `GridHelper`. Pointer spawn still uses the mathematical ground plane at \(y = 0\) when the mesh is hidden. |
| `Ground color` | Color picker for the floor `MeshStandardMaterial` (does not change the grid line colors). |

## Capture Pane

Separate bottom-left Tweakpane used for recording-friendly camera motion. These controls are demo-only and do not affect exported presets.

| Control | Effect |
| --- | --- |
| `Orbit camera` | Toggles continuous camera orbit around the scene target. |
| `Orbit deg/s` | Constant angular speed in degrees per second (negative reverses direction). |
| `FPS` | Essentials plugin `fpsgraph` blade showing frame-time/fps trend. |
| `Runtime stats` | Read-only live summary of active particle systems (`systems`, CPU/GPU counts, total alive/max particles, busiest effect). |

## Controls Folder

| Control | Effect |
| --- | --- |
| `click` | Selects the effect spawned by pointer clicks and buttons (including **Speed visual (CPU)**, **Candy vortex**, and **Shockwave** which now spawns a ring + center blast + shrapnel burst). |
| `Spawn at center` | Spawns the selected effect near the center of the scene. |
| `Load selected into editor` | Copies a built-in preset into the custom editor controls. |
| `Preview loop` | Spawns or respawns the custom effect as a loop preview. |
| `Clear systems` | Disposes all systems tracked by the demo `ParticleWorld`. |
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
| `debug all` | Runtime `ParticleWorld.setDebug` |
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
| `random frame` | `textureSheet.randomFrame` |
| `over lifetime` | `textureSheet.frameOverLifetime` |

## Custom Image Loading

`Load billboard image` opens a local file input. The demo creates a `THREE.CanvasTexture`.

If `image alpha` is enabled, image alpha is multiplied by luminance so white-on-black images can become useful alpha sprites.

