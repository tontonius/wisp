# Lifecycle And Callbacks Reference

Particle systems have two related lifecycles:

- Emission lifecycle: whether the system is playing and spawning particles.
- Particle lifecycle: whether individual particles are alive.

## System Getters

```ts
system.elapsed;
system.aliveCount;
system.isAlive;
system.isPlaying;
system.isComplete;
system.isDisposed;
```

| Getter | Description |
| --- | --- |
| `elapsed` | Emission time in seconds. Resets on `stop` and after `prewarm`. |
| `aliveCount` | Live particles on CPU; conservative value on GPU. |
| `isAlive` | Whether particles may still be alive. |
| `isPlaying` | Whether emission is active. |
| `isComplete` | Whether emission is complete and particles are no longer alive. |
| `isDisposed` | Whether backend resources have been disposed. |

## Methods

### `play()`

Starts or resumes emission.

```ts
system.play();
```

Calls `callbacks.onStart` only when the system was not already playing.

### `pause()`

Pauses emission.

```ts
system.pause();
```

Existing particles continue simulating if `update` is called.

### `stop(options?)`

Stops emission, marks emission complete, resets emission bookkeeping.

```ts
system.stop();
system.stop({ clear: false });
```

Default:

```ts
clear: true
```

With `clear: true`, live particles are killed/cleared.

With `clear: false`, existing particles continue aging while no new particles emit.

### `restart()`

```ts
system.restart();
```

Equivalent to clearing stop plus play. Calls `callbacks.onStart`.

### `emit(count)`

```ts
system.emit(20);
```

Spawns or queues particles immediately, independent of `duration`.

### `update(dt, camera)`

```ts
system.update(dt, camera);
```

Must be called every frame for simulation and rendering.

Calls `callbacks.onComplete` once when completion is observed.

### `dispose(options?)`

```ts
system.dispose();
```

Disposes backend resources, gizmos, geometry, and material, then removes the system from its parent.

## Callbacks

```ts
type ParticleLifecycleCallbacks = {
  onStart?: (system: ParticleSystem) => void;
  onStop?: (system: ParticleSystem) => void;
  onComplete?: (system: ParticleSystem) => void;
  onParticleBirth?: (particle: ParticleSnapshot, system: ParticleSystem) => void;
  onParticleDeath?: (particle: ParticleSnapshot, system: ParticleSystem) => void;
  onParticleCollision?: (particle: ParticleSnapshot, system: ParticleSystem) => void;
};
```

### `onStart`

Called by `play` and `restart`.

### `onStop`

Called by `stop` when the system was playing or alive.

### `onComplete`

Called once from `ParticleSystem.update` when the backend reports complete.

### `onParticleDeath`

CPU-only.

```ts
type ParticleSnapshot = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  lifetime: number;
};
```

The snapshot clones position and velocity so callbacks do not mutate internal particle state.

GPU particle death is not reported because reading particle death back from the GPU would defeat the GPU backend's purpose.

### `onParticleBirth`

CPU-only.

Called when a CPU particle is spawned. The snapshot clones position and velocity.

### `onParticleCollision`

CPU-only.

Called when a particle penetrates the CPU collision plane and is resolved. The snapshot clones position and velocity, like `onParticleDeath`.

## ParticleWorld Auto-Cleanup

```ts
particles.update(dt, camera);
```

During update, `ParticleWorld` disposes and removes a system when:

```ts
(system.preset.autoDispose ?? true) && system.isComplete
```

Set this for persistent loops:

```ts
autoDispose: false,
loop: true,
```

