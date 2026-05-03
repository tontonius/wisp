# Renderer Reference

The `renderer` preset section controls particle billboard rendering.

```ts
renderer?: {
  texture?: THREE.Texture;
  blendMode?: BlendMode;
  align?: AlignMode;
  depthWrite?: boolean;
  depthTest?: boolean;
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
| `texture` | Generated soft radial disc | Billboard sprite texture. |
| `blendMode` | `"alpha"` | Material blend mode. |
| `align` | `"camera"` | Billboard orientation. |
| `depthWrite` | `false` | Whether particles write to the depth buffer. |
| `depthTest` | `true` | Whether particles test against scene depth. |
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

## Depth Options

```ts
depthWrite: false,
depthTest: true,
```

`depthWrite: false` is the default because transparent particles usually should not write depth.

Set `depthTest: false` for always-visible screen-space-ish or stylized effects. Use carefully; it can make particles appear through walls or geometry.

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

