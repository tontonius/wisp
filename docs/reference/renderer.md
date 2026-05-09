# Renderer Reference

The `renderer` preset section controls particle billboard rendering.

```ts
renderer?: {
  type?: "billboard" | "stretchedBillboard";
  texture?: THREE.Texture;
  alphaFromLuminance?: {
    enabled?: boolean;
    blackCutoff?: number;
  };
  blendMode?: BlendMode;
  align?: AlignMode;
  sorting?: "none" | "distance" | "youngestFirst" | "oldestFirst";
  stretchFactor?: number;
  stretchMaxScale?: number;
  depthWrite?: boolean;
  depthTest?: boolean;
  softParticles?: boolean;
  softness?: number;
  textureSheet?: {
    columns: number;
    rows: number;
    animationMode?: "static" | "randomStart" | "overLifetime" | "randomStartOverLifetime";
  };
  dispersal?: {
    enabled?: boolean;
    strength?: number;
    amount?: Array<[number, number]>;
    noiseScale?: number;
    edgeSoftness?: number;
    texture?: THREE.Texture;
    scroll?: [number, number];
  };
};
```

## Defaults

| Field | Default | Description |
| --- | --- | --- |
| `type` | `"billboard"` | Quad geometry mode. |
| `texture` | Generated soft radial disc | Billboard sprite texture. |
| `alphaFromLuminance` | `undefined` | Optional runtime keying for black-background sprite art. |
| `blendMode` | `"alpha"` | Material blend mode. |
| `align` | `"camera"` | Billboard orientation. |
| `sorting` | `"distance"` | CPU-only draw order for alive particles (see [Sorting](#sorting)). |
| `stretchFactor` | `0.35` | Speed-to-length scaling for `type: "stretchedBillboard"`. |
| `stretchMaxScale` | `4` | Maximum length scale for `type: "stretchedBillboard"`. |
| `depthWrite` | `false` | Whether particles write to the depth buffer. |
| `depthTest` | `true` | Whether particles test against scene depth. |
| `softParticles` | `false` | Enables depth-based edge fading when a scene depth texture is provided at runtime. |
| `softness` | `1.5` | Fade strength for soft particles. Higher values fade more aggressively at intersections. |
| `textureSheet` | `undefined` | Optional flipbook/atlas settings. |
| `dispersal` | `undefined` | Optional spatial dissolve of alpha over lifetime (see [Dispersal](#dispersal)). |

## Type

```ts
type: "billboard" | "stretchedBillboard"
stretchFactor?: number
stretchMaxScale?: number
```

`"billboard"` keeps symmetric quads and is the default.

`"stretchedBillboard"` elongates each quad along particle velocity, scaled by speed with `stretchFactor` and clamped by `stretchMaxScale`. It is supported by the CPU backend and the experimental WebGPU backend. Other GPU backends fall back to CPU for this renderer type.

## Texture

```ts
const texture = new THREE.TextureLoader().load("/particles/smoke.png");
texture.colorSpace = THREE.SRGBColorSpace;

renderer: {
  texture,
}
```

If no texture is supplied, the library creates a small soft white radial disc.

### Optional Black-Background Keying

For sprite sheets authored as bright smoke/fire on black backgrounds, you can convert near-black pixels to transparent alpha at runtime:

```ts
renderer: {
  texture,
  alphaFromLuminance: {
    enabled: true,
    blackCutoff: 32, // 0..255, higher removes more dark pixels
  },
  blendMode: "alpha",
}
```

Notes:

- Pixels with luminance `<= blackCutoff` are forced to alpha `0`.
- Higher `blackCutoff` removes more dark halo; lower preserves more edge detail.
- This is applied once when the particle material is created (CPU and GPU backends).

Texture ownership:

- The system does not dispose supplied textures by default.
- `system.dispose({ disposeTexture: true })` disposes the renderer texture.
- Use `disposeTexture: true` only for textures not shared elsewhere.

## Blend Mode

```ts
blendMode: "alpha" | "additive" | "multiply"
```

Mapping:

| Value | Three.js Blending |
| --- | --- |
| `"alpha"` | `THREE.NormalBlending` |
| `"additive"` | `THREE.AdditiveBlending` |
| `"multiply"` | `THREE.MultiplyBlending` |

Practical guidance:

- Use `additive` for sparks, fire, magic, glows, and GPU ambience when possible.
- Use `alpha` for smoke or soft particles with real alpha.
- Use `multiply` sparingly for stylized darkening effects.

## Alignment

```ts
align: "camera" | "velocity"
```

`"camera"`:

- Quads face the camera using camera right/up vectors.
- Best default for smoke, glow discs, aura particles, and most sprites.

`"velocity"`:

- The quad's horizontal axis follows particle velocity.
- Useful for sparks, rain streaks, speed lines, and muzzle particles.
- Falls back toward camera alignment if velocity is near zero.

## Sorting

```ts
sorting: "none" | "distance" | "youngestFirst" | "oldestFirst"
```

CPU-only. Controls the order in which alive particles are written into the geometry buffer each frame. Because particles render with `depthWrite: false` by default, write order determines visual layering for transparent quads.

| Value | Behavior |
| --- | --- |
| `"none"` | Alive particles are written in slot order. Cheapest, but layering is essentially random. |
| `"distance"` | Back-to-front by world-space camera depth. Farther particles draw first, so closer ones overlay them. Correct for alpha blending. **Default.** |
| `"youngestFirst"` | Younger particles are drawn last, so they appear in front of older ones. |
| `"oldestFirst"` | Older particles are drawn last, so they appear in front of younger ones. |

Notes:

- The sort runs every frame on the CPU and is `O(n log n)` over alive particles. CPU effects typically have small particle counts, so the cost is negligible; if you author very large CPU systems with additive blending, set `sorting: "none"` to skip the work.
- The GPU backend ignores `sorting` and renders unsorted. Validation logs a warning when a GPU-bound preset sets `sorting` to anything other than `"none"`.
- `"distance"` uses the system's world-space transform, so reparenting or moving the system updates depth ordering correctly.

## Depth Options

```ts
depthWrite: false,
depthTest: true,
```

`depthWrite: false` is the default because transparent particles usually should not write depth.

Set `depthTest: false` for always-visible screen-space-ish or stylized effects. Use carefully; it can make particles appear through walls or geometry.

## Soft Particles (Opt-In)

```ts
renderer: {
  blendMode: "alpha",
  softParticles: true,
  softness: 1.5,
}
```

Soft particles fade alpha where billboard pixels intersect scene geometry depth. This removes hard clipping seams on smoke/fog/dust style effects.

Runtime depth texture hookup:

```ts
system.setSoftParticleDepthTexture(depthTexture, {
  width: depthTarget.width,
  height: depthTarget.height,
});
```

Notes:

- `renderer.softParticles` only enables shader logic; it does not create a depth texture for you.
- Pass `null` to `setSoftParticleDepthTexture(null)` to disable depth-fade at runtime.
- WebGPU supports soft particles in the authoritative TSL billboard path when a perspective-camera depth texture is provided.
- For additive-only effects (sparks, glows), soft particles are often unnecessary.

## Dispersal

Optional **dispersal** breaks up each billboard’s alpha with a noise threshold that advances over normalized lifetime, instead of fading every pixel uniformly. It multiplies `overLifetime.opacity` (and sprite alpha): keep opacity flat and drive death mostly with dispersal, combine both for layered smoke, or use an `amount` curve so dissolve ramps only in the last part of life.

```ts
renderer: {
  blendMode: "alpha",
  dispersal: {
    strength: 1,
    noiseScale: 6,
    edgeSoftness: 0.12,
    scroll: [0.02, 0.01],
    amount: [
      [0, 0],
      [0.65, 0],
      [1, 1],
    ],
  },
}
```

| Field | Default | Description |
| --- | --- | --- |
| `enabled` | `true` when `dispersal` is set | Set `false` to disable without removing the block. |
| `strength` | `1` | How much the dissolve mask affects alpha (`0`..`1`). |
| `amount` | Linear in age | Curve mapping normalized age → dissolve amount (`0` = no cutoff, `1` = full dissolve). |
| `noiseScale` | `6` | UV scale for sampling procedural noise or `texture`. |
| `edgeSoftness` | `0.12` | Width of the soft threshold band (must be greater than 0). |
| `texture` | `undefined` | Optional map; **R** channel is used as noise. Omit for built-in value noise. |
| `scroll` | `[0, 0]` | Added to sample UVs as `scroll * systemElapsedTime` for slow drift. |

Notes:

- Sampling uses the same UVs as the billboard (including texture sheet atlas UVs), so dissolve follows sprite space.
- **Soft particles** run first; dispersal multiplies alpha afterward.
- **Additive** blending still discards low alpha; holes can read as black against dark backgrounds—preview with your scene.
- WebGPU supports dispersal in the authoritative TSL billboard path, including optional `dispersal.texture` map sampling.
- Texture ownership matches the main renderer texture: the library does not dispose your `dispersal.texture` unless you pass `disposeTexture: true` on `ParticleSystem.dispose` (and it is not the same object as `renderer.texture`).

## Shader Behavior

The fragment shader samples `uTexture`, multiplies by vertex/lifetime color, optionally applies soft particles, optionally multiplies alpha by the dispersal mask, then discards near-zero alpha:

```txt
outColor = texture * particleColor
soft depth fade (if enabled)
dispersal mask on alpha (if enabled)
discard if alpha < 0.001
```

CPU backend:

- Rebuilds billboard vertex positions/colors on the CPU each update.

GPU backend:

- Uses static quad geometry.
- Vertex shader samples GPU state textures to position and color each particle.

## Texture Sheets

For atlas animation, see [Texture Sheets](texture-sheets.md).
