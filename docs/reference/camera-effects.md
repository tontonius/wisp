# Camera Effects

Wisp v0.2 adds a first camera module focused on trauma-based shake.

Core exports:

- `CameraShakeController`
- `CameraEffectsSystem`
- `Wisp`
- `WispCamera`
- `CameraShakeOptions`
- `CameraShakeImpulse`
- `CameraEffectsOptions`

## `CameraShakeController`

Low-level controller that applies shake directly to a `THREE.Camera`.

```ts
new CameraShakeController(camera, options?)
```

Methods:

- `shake(impulse)` adds trauma (`number` or `{ trauma: number }`).
- `addTrauma(amount)` adds trauma directly.
- `update(dt)` advances decay and applies coherent shake offsets.
- `configure(options?)` replaces shake tuning at runtime.
- `reset()` clears trauma and restores the pre-shake transform.
- `dispose()` alias for cleanup/reset behavior.

Behavior:

- Trauma is clamped to `[0, 1]`.
- Decay is linear (`trauma -= decayRate * dt`).
- Amplitude uses nonlinear scaling (`Math.pow(trauma, traumaExponent)`).
- Noise is coherent over time (no frame-random jitter).

## `CameraEffectsSystem`

First high-level camera-effects wrapper for the camera module.

```ts
new CameraEffectsSystem(camera, shakeOptions?)
```

Methods:

- `shake(impulse)`
- `configureShake(options?)`
- `update(dt)`
- `reset()`
- `dispose()`

Getter:

- `trauma` current trauma value.

## `Wisp` + `WispCamera`

Wisp-facing API shape for camera effects:

```ts
const wisp = new Wisp(camera, {
  shake: {
    decayRate: 1.4,
    traumaExponent: 2,
  },
});

wisp.camera.shake(0.35);
wisp.update(dt);
```

`WispCamera` methods:

- `shake(impulse)`
- `configureShake(options?)`
- `update(dt)`
- `reset()`

Getter:

- `trauma` current trauma value.

## `CameraShakeOptions`

```ts
{
  decayRate?: number;
  traumaExponent?: number;
  noiseFrequency?: number;
  mode?: "rotationOnly" | "rotationAndTranslation";
  maxRotation?: [pitch: number, yaw: number, roll: number];
  maxTranslation?: [x: number, y: number, z: number];
}
```

Notes:

- `maxRotation` is in radians.
- For most 3D games, keep `mode: "rotationOnly"` to avoid positional clipping issues.
- Translation mode is mainly for 2D/non-clipping setups.
- VR is not a supported target for camera shake due to comfort concerns.
