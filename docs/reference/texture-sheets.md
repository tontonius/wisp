# Texture Sheets Reference

Texture sheets let one texture contain multiple particle frames.

```ts
renderer: {
  texture: flipbookTexture,
  textureSheet: {
    columns: 4,
    rows: 4,
    randomFrame: true,
    frameOverLifetime: true,
  },
}
```

## Fields

| Field | Default | Description |
| --- | --- | --- |
| `columns` | Required | Number of columns in the atlas. Clamped to at least `1`. |
| `rows` | Required | Number of rows in the atlas. Clamped to at least `1`. |
| `randomFrame` | `false` | Whether each particle starts on a random frame. |
| `randomStartFrame` | Alias | Backward-compatible alias for `randomFrame`. |
| `frameOverLifetime` | `false` | Whether frame advances by normalized age. |

Total frames:

```ts
totalFrames = columns * rows
```

## Frame Selection

Base frame:

- `0` by default.
- Random frame if `randomFrame` or `randomStartFrame` is true.

Lifetime advancement:

```ts
if (frameOverLifetime) {
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
  randomFrame: true,
}
```

Flipbook animation:

```ts
textureSheet: {
  columns: 4,
  rows: 4,
  frameOverLifetime: true,
}
```

Randomized flipbook start:

```ts
textureSheet: {
  columns: 4,
  rows: 4,
  randomFrame: true,
  frameOverLifetime: true,
}
```

## Backend Notes

CPU:

- UVs are written into the CPU geometry each frame.

GPU:

- Frame selection happens in the render vertex shader.
- Start frame is packed into the GPU `extra` render target.

