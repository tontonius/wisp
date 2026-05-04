# Rendering Model

Particles render as textured billboard quads.

## Billboard Basics

Each particle is represented by two triangles, six vertices total.

The quad center is the particle position. The quad size comes from:

```ts
start.size * overLifetime.size(t)
```

The final color comes from:

```ts
texture * start.color * overLifetime.color(t) * opacity
```

## Camera Alignment

With `align: "camera"`, the quad uses camera right and up vectors. It behaves like a sprite facing the viewer.

This is the default and works for most soft particles.

## Velocity Alignment

With `align: "velocity"`, the quad aligns along the particle velocity direction.

This is useful for:

- Sparks.
- Rain streaks.
- Fast directional particles.

When velocity is too small, the system falls back to camera-like alignment.

## Blending

The material is transparent and supports:

- Alpha blending.
- Additive blending.
- Multiply blending.

The CPU backend sorts particles each frame (default: back-to-front by camera depth) so alpha blending lays out correctly. The GPU backend renders unsorted, which is why additive blending — order-independent — is the happiest path for GPU-heavy effects.

## CPU Rendering

The CPU backend builds dynamic geometry each update:

- Position attribute.
- UV attribute.
- Particle color attribute.

Alive particles are gathered into a sort order chosen by `renderer.sorting` (default `"distance"`), then quad vertices are written in that order. Only live particles are included in draw range. See [Renderer reference: Sorting](../reference/renderer.md#sorting) for the available modes and trade-offs.

## GPU Rendering

The GPU backend uses static render geometry.

Each particle vertex stores:

- Quad corner.
- UV into the particle state textures.
- Base texture UV.

The vertex shader samples state textures and expands each billboard on the GPU.

## Texture Sheets

Texture sheets are atlas UV transforms. They do not create separate materials.

Frame selection uses:

- Optional random start frame.
- Optional lifetime frame advancement.

