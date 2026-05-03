# Debug Emitters

Use debug gizmos when an effect spawns from the wrong place, emits in the wrong direction, or has confusing shape settings.

## Enable Debug In A Preset

```ts
const coneBurst: ParticlePreset = {
  emitter: { type: "cone", radius: 0.2, angle: 30, length: 2 },
  debug: {
    enabled: true,
    emitter: true,
    spawnDirection: true,
  },
};
```

## Enable Debug At Runtime

```ts
system.setDebug(true);
```

With options:

```ts
system.setDebug({
  enabled: true,
  color: "#ffcc33",
  opacity: 0.7,
  segments: 32,
});
```

## Enable Debug For A World

```ts
particles.setDebug({
  enabled: true,
  color: "#78d7ff",
});
```

This updates currently tracked systems and becomes the default for later `particles.spawn` calls.

## Spawn With Debug Override

```ts
particles.spawn("muzzleFlash", {
  position: gunTip,
  debug: true,
});
```

## What To Look For

- Point: cross at origin.
- Sphere: three circles.
- Hemisphere: upper half volume.
- Cone: spawn disc plus target spread and +Y direction.
- Box: wireframe volume.

If the gizmo is correct but particles appear elsewhere, inspect the `ParticleSystem` transform or parent transform.

