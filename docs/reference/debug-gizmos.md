# Debug Gizmos Reference

Debug gizmos draw line helpers for emitter shapes and spawn direction.

```ts
debug?: boolean | ParticleDebugOptions;
```

Options:

```ts
type ParticleDebugOptions = {
  enabled?: boolean;
  emitter?: boolean;
  spawnDirection?: boolean;
  bounds?: boolean;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  segments?: number;
};
```

## Defaults

| Field | Default | Description |
| --- | --- | --- |
| `enabled` | `false` for omitted/false, `true` for `true` | Whether the gizmo is visible. |
| `emitter` | `true` | Draw emitter shape. |
| `spawnDirection` | `true` | Draw direction arrow. |
| `bounds` | `true` | Draw explicit `preset.bounds` sphere when present. |
| `color` | `"#78d7ff"` | Gizmo line color. |
| `opacity` | `0.85` | Gizmo line opacity. |
| `segments` | `48`, minimum `8` | Circle/arc segment count. |

## Enable Per Preset

```ts
const preset: ParticlePreset = {
  emitter: { type: "cone", radius: 0.2, angle: 30, length: 2 },
  debug: {
    enabled: true,
    emitter: true,
    spawnDirection: true,
  },
};
```

## Toggle Runtime Debug

```ts
system.setDebug(true);
system.setDebug(false);
```

With options:

```ts
system.setDebug({
  enabled: true,
  color: "#ffcc33",
  opacity: 0.7,
});
```

## World-Wide Debug

```ts
particles.setDebug({
  enabled: true,
  color: "#78d7ff",
});
```

`ParticleWorld.setDebug` applies settings to currently tracked systems and stores the setting as the default for later spawns.

## Shape Coverage

Gizmos support:

- Point.
- Sphere.
- Hemisphere.
- Cone.
- Box.

Cone gizmos show:

- Spawn disc radius.
- Cone length.
- Angle spread target radius.
- Direction arrow along local +Y.

When `preset.bounds` is set, debug gizmos also draw the culling sphere (three great circles around `bounds.center` with `bounds.radius`).

## Disposal

`ParticleSystem.dispose()` disposes the gizmo geometry and material.

Calling `setDebug` with enabled options replaces and disposes the previous gizmo.

