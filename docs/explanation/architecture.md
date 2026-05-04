# Architecture

The system is built around a small public API and two simulation backends.

```txt
ParticleWorld
  └─ ParticleEffectLibrary
       └─ ParticleSystem
            ├─ CPU backend
            └─ GPU backend
```

## Preset-Driven Authoring

Effects are described as `ParticlePreset` objects:

```ts
const preset: ParticlePreset = {
  emitter: { type: "sphere", radius: 0.2 },
  emission: { bursts: [{ time: 0, count: 40 }] },
  start: { lifetime: [0.4, 1.2], speed: [2, 6] },
};
```

The preset is the authoring contract. Both CPU and GPU backends read the same shape where possible.

## Runtime Objects

`ParticleWorld` is the game-facing manager:

- Owns a named effect registry.
- Spawns effects by name.
- Tracks live systems.
- Updates all systems.
- Auto-disposes completed one-shots, or optionally resets them into an inactive pool when `ParticleWorldOptions.pooling` is enabled.

`ParticleEffectLibrary` is the lower-level registry:

- Registers presets.
- Retrieves presets.
- Spawns a `ParticleSystem` from a name (always allocates; does not use `ParticleWorld` pooling).

`ParticleSystem` is a live effect:

- Extends `THREE.Object3D`.
- Selects a backend.
- Exposes playback, update, debug, and disposal methods.

## Backend Boundary

CPU and GPU backends implement the same internal interface:

```txt
play
pause
stop
restart
emit
update
dispose
```

This lets `ParticleSystem` expose one public API while the backends use very different storage and rendering strategies.

## Why Two Backends

CPU is better for:

- Small precise effects.
- Gameplay integration.
- Callbacks.
- Optional primitive collision (`plane`, `sphere`, `box`) and future richer colliders (raycast/mesh).
- Future sub-emitter features.

GPU is better for:

- Large ambient effects.
- Thousands of particles.
- Visual-only simulation.
- Avoiding CPU geometry updates.

Trying to make one backend perfect for both would make the system more complicated and less honest.

## Rendering

Both backends render billboard quads.

CPU:

- Writes quad vertices into a dynamic `BufferGeometry`.
- Uses per-vertex particle colors.

GPU:

- Uses static quad geometry.
- Vertex shader samples particle state textures.
- Simulation shader updates state textures.

## Design Goal

The target feeling is Unity-like effect authoring with Three.js-native runtime ergonomics:

```ts
particles.spawn("fireballImpact", { position: hit.point });
particles.update(dt, camera);
```

The user should not need to think about render targets, shader uniforms, or backend storage unless they are working on the internals.

