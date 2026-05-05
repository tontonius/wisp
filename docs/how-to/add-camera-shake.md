# Add Trauma-Based Camera Shake

Use the `Wisp` camera module to add event-driven shake with linear trauma decay and nonlinear intensity.

## 1) Create one Wisp instance for modules

```ts
import { Wisp } from "@wisp/three";

const wisp = new Wisp({
  scene,
  camera,
  cameraEffects: {
    shake: {
      decayRate: 1.4,
      traumaExponent: 2,
      noiseFrequency: 22,
    },
  },
  particles: {
    presets: { explosion },
    renderer,
  },
});
```

You can still use the legacy constructor (`new Wisp(camera, { shake: ... })`), but the object form keeps camera and particles consistent under one facade.

## 2) Trigger shake from gameplay events

```ts
wisp.camera.shake(0.25); // small hit
wisp.camera.shake(0.7); // large impact
```

You can also pass object syntax:

```ts
wisp.camera.shake({ trauma: 0.35 });
```

Trauma is clamped to `[0, 1]`, so multiple events can stack safely.

## 3) Update every frame

```ts
function animate() {
  const dt = clock.getDelta();
  wisp.update(dt);
  renderer.render(scene, camera);
}
```

## 4) Tune feel

- Increase `decayRate` for snappier, shorter shakes.
- Increase `traumaExponent` (`2` to `3`) for subtler low-trauma response and punchier high-trauma response.
- Increase `noiseFrequency` for more rapid handheld motion.
- Tune `maxRotation` to cap total angular displacement.

## 3D recommendation

Use rotation-only shake in 3D. Translational shake can push cameras into geometry and cause clipping.

## VR recommendation

Avoid camera shake in VR due to comfort and motion-sickness risk.
