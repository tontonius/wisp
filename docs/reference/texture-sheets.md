# Texture Sheets Reference

Texture sheets let one texture contain multiple particle frames.

```ts
renderer: {
  texture: flipbookTexture,
  textureSheet: {
    columns: 4,
    rows: 4,
    animationMode: "randomStartOverLifetime",
  },
}
```

## Fields

| Field | Default | Description |
| --- | --- | --- |
| `columns` | Required | Number of columns in the atlas. Clamped to at least `1`. |
| `rows` | Required | Number of rows in the atlas. Clamped to at least `1`. |
| `animationMode` | `"static"` | High-level frame selection mode: `"static"`, `"randomStart"`, `"overLifetime"`, `"randomStartOverLifetime"`. |

Total frames:

```ts
totalFrames = columns * rows
```

## Frame Selection

`animationMode` controls both start randomization and lifetime advancement:

- `"static"`: frame `0`, no advancement
- `"randomStart"`: random start frame, no advancement
- `"overLifetime"`: frame `0` plus lifetime advancement
- `"randomStartOverLifetime"`: random start plus lifetime advancement

Base frame:

- `0` by default.
- Random frame for modes with `"randomStart"`.

Lifetime advancement:

```ts
if (animationMode advances over lifetime) {
  frame += floor(ageT * totalFrames)
}
```

The result is clamped to `0..totalFrames - 1`.

## UV Layout

Frames are indexed left-to-right, top-to-bottom.

For a 4x4 sheet:

```txt
0  1  2  3
4  5  6  7
8  9  10 11
12 13 14 15
```

## Common Configurations

Random static variant:

```ts
textureSheet: {
  columns: 4,
  rows: 4,
  animationMode: "randomStart",
}
```

Flipbook animation:

```ts
textureSheet: {
  columns: 4,
  rows: 4,
  animationMode: "overLifetime",
}
```

Randomized flipbook start:

```ts
textureSheet: {
  columns: 4,
  rows: 4,
  animationMode: "randomStartOverLifetime",
}
```

## Backend Notes

CPU:

- UVs are written into the CPU geometry each frame.

WebGL GPU:

- Frame selection happens in the render vertex shader.
- Start frame is packed into the GPU `extra` render target.

WebGPU:

- Texture sheets are supported in the authoritative TSL billboard path.
- The CPU lifecycle mirror selects the current frame from `animationMode`; TSL samples the atlas with a per-instance frame attribute.
- `alphaFromLuminance` uses the shared runtime texture-keying step before the TSL material samples the atlas.
