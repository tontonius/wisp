# Renderer Reference

The `renderer` preset section controls particle billboard rendering.

```ts
renderer?: {
  type?: "billboard" | "stretchedBillboard";
  texture?: THREE.Texture;
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
    randomFrame?: boolean;
    frameOverLifetime?: boolean;
    randomStartFrame?: boolean;
  };
};
```

## Defaults

| Field | Default | Description |
| --- | --- | --- |
| `type` | `"billboard"` | Quad geometry mode. |
| `texture` | Generated soft radial disc | Billboard sprite texture. |
| `blendMode` | `"alpha"` | Material blend mode. |
| `align` | `"camera"` | Billboard orientation. |
| `sorting` | `"distance"` | CPU-only draw order for alive particles (see [Sorting](#sorting)). |
| `depthWrite` | `false` | Whether particles write to the depth buffer. |
| `depthTest` | `true` | Whether particles test against scene depth. |
| `softParticles` | `false` | Enables depth-based edge fading when a scene depth texture is provided at runtime. |
| `softness` | `1.5` | Fade strength for soft particles. Higher values fade more aggressively at intersections. |
| `textureSheet` | `undefined` | Optional flipbook/atlas settings. |

## Texture

```ts
const texture = new THREE.TextureLoader().load("/particles/smoke.png");
texture.colorSpace = THREE.SRGBColorSpace;

renderer: {
  texture,
}
```

If no texture is supplied, the library creates a small soft white radial disc.

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
- For additive-only effects (sparks, glows), soft particles are often unnecessary.

## Shader Behavior

The fragment shader samples `uTexture`, multiplies by vertex/lifetime color, and discards near-zero alpha:

```txt
outColor = texture * particleColor
discard if alpha < 0.001
```

CPU backend:

- Rebuilds billboard vertex positions/colors on the CPU each update.

GPU backend:

- Uses static quad geometry.
- Vertex shader samples GPU state textures to position and color each particle.

## Texture Sheets

For atlas animation, see [Texture Sheets](texture-sheets.md).

