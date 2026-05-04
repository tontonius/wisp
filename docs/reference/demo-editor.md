# Demo Editor Reference

The demo in `demo/main.ts` includes a Tweakpane editor for creating and copying `ParticlePreset` code.

## URL parameters

| Query | Effect |
| --- | --- |
| `?pool=1` | Enables `ParticleWorld` inactive pooling (`pooling: true`) so repeated one-shot spawns reuse GPU/CPU backends. |

## Controls Folder

| Control | Effect |
| --- | --- |
| `click` | Selects the effect spawned by pointer clicks and buttons. |
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
| `gravity y` | `forces.gravity[1]` |
| `drag` | `forces.drag` |
| `noise strength` | `forces.noise.strength` |
| `noise frequency` | `forces.noise.frequency` |

## Color Over Lifetime Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `overLifetime.color` is included. |
| `start color` | First color stop. |
| `mid color` | Middle color stop at `0.45`. |
| `end color` | Final color stop. |
| `alpha fade in` | First full-opacity stop in `overLifetime.opacity`. |
| `alpha fade out` | Last full-opacity stop in `overLifetime.opacity`. |

When color-over-lifetime is enabled, the demo sets `start.color` to white so the gradient controls own the visible color.

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

## Renderer Folder

| Control | Preset Field |
| --- | --- |
| `enabled` | Whether `renderer` is included. |
| `texture` | Demo texture selection. |
| `image alpha` | Demo-only preprocessing for custom images. |
| `blend` | `renderer.blendMode` |
| `align` | `renderer.align` |

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

