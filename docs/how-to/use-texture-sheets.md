# Use Texture Sheets

Use a texture sheet when one texture contains multiple particle frames or variants.

## Static Random Variants

```ts
renderer: {
  texture: sparkleAtlas,
  textureSheet: {
    columns: 4,
    rows: 4,
    randomFrame: true,
  },
}
```

Each particle starts on a random tile and stays there.

## Flipbook Over Lifetime

```ts
renderer: {
  texture: explosionFlipbook,
  textureSheet: {
    columns: 4,
    rows: 4,
    frameOverLifetime: true,
  },
}
```

Each particle advances through the atlas based on normalized age.

## Randomized Flipbook Starts

```ts
renderer: {
  texture: magicAtlas,
  textureSheet: {
    columns: 4,
    rows: 4,
    randomFrame: true,
    frameOverLifetime: true,
  },
}
```

This offsets starting frames per particle while still advancing over lifetime.

## Texture Setup

```ts
const texture = new THREE.TextureLoader().load("/particles/explosion-sheet.png");
texture.colorSpace = THREE.SRGBColorSpace;
```

Use transparent PNGs for alpha blending. For additive effects, white-on-black sprite sheets can work well.

