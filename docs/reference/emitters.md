# Emitters Reference

Emitters define where particles spawn and what their initial direction is before `start.speed` and `start.velocity` are applied.

```ts
type EmitterShape =
  | { type: "point" }
  | { type: "sphere"; radius?: number; emitFrom?: "volume" | "shell" }
  | { type: "hemisphere"; radius?: number; emitFrom?: "volume" | "shell" }
  | { type: "disc"; radius?: number; emitFrom?: "volume" | "shell" }
  | { type: "cone"; radius?: number; angle?: number; length?: number }
  | { type: "box"; size?: Vec3Tuple };
```

If `emitter` is omitted, the default is:

```ts
{ type: "point" }
```

## Coordinate Space

Emitter positions and directions are local to the `ParticleSystem` object. Move, rotate, or scale the system by using the normal `THREE.Object3D` transform or spawn options.

## Point

```ts
emitter: { type: "point" }
```

Behavior:

- Spawns at local origin.
- Direction is a random unit vector.

Good for:

- Explosions.
- Omnidirectional sparks.
- Simple placeholder effects.

## Sphere

```ts
emitter: {
  type: "sphere",
  radius: 1,
  emitFrom: "volume",
}
```

Fields:

| Field | Default | Description |
| --- | --- | --- |
| `radius` | `1` | Sphere radius. |
| `emitFrom` | `"volume"` | `"volume"` samples inside the sphere; `"shell"` samples on the surface. |

Behavior:

- Direction points outward from the sampled position.
- `emitFrom: "shell"` produces a hollow shell burst.

## Hemisphere

```ts
emitter: {
  type: "hemisphere",
  radius: 1.5,
  emitFrom: "shell",
}
```

Fields:

| Field | Default | Description |
| --- | --- | --- |
| `radius` | `1` | Hemisphere radius. |
| `emitFrom` | `"volume"` | `"volume"` samples inside; `"shell"` samples on the surface. |

Behavior:

- The hemisphere is the positive local-Y half of a sphere.
- Direction is reflected upward if needed, so particles emit into positive local Y.

Good for:

- Ground sparkles.
- Magic auras.
- Upward mist.

## Cone

```ts
emitter: {
  type: "cone",
  radius: 0.1,
  angle: 25,
  length: 1,
}
```

Fields:

| Field | Default | Description |
| --- | --- | --- |
| `radius` | `0.1` | Radius of the spawn disc at local origin. |
| `angle` | `25` | Cone spread angle in degrees. |
| `length` | `1` | Distance to the virtual target plane. |

Behavior:

- Particles spawn on a disc in the local XZ plane.
- Particles aim generally along local +Y.
- `angle` and `length` control the random target spread.

Good for:

- Muzzle flashes.
- Jets.
- Fire plumes.
- Directed bursts.

## Disc

```ts
emitter: {
  type: "disc",
  radius: 1,
  emitFrom: "volume",
}
```

Fields:

| Field | Default | Description |
| --- | --- | --- |
| `radius` | `1` | Disc radius on the local XZ plane. |
| `emitFrom` | `"volume"` | `"volume"` samples across disc area; `"shell"` samples only the rim. |

Behavior:

- The disc lies in local XZ at `y = 0`.
- Direction is fixed to local `+Y`.

Good for:

- Fountain bases.
- Ground auras.
- Upward plumes from circular emitters.

## Box

```ts
emitter: {
  type: "box",
  size: [10, 2, 10],
}
```

Fields:

| Field | Default | Description |
| --- | --- | --- |
| `size` | `[1, 1, 1]` | Width, height, depth of the local spawn volume. |

Behavior:

- Spawns uniformly within the box volume.
- Direction is a random unit vector.

Good for:

- Rain.
- Snow.
- Ambient motes.
- Volumetric fields.

## Debug Gizmos

All emitter shapes have line gizmos. Enable them through `debug`:

```ts
debug: {
  enabled: true,
  emitter: true,
  spawnDirection: true,
}
```

See [Debug Gizmos](debug-gizmos.md).

