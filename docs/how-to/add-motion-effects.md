# Add Motion Effects

Use Wisp Motion when your game already controls transforms and you only want presentation offsets layered on top.

## 1) Enable the motion module

```ts
const wisp = new Wisp({
  camera,
  motion: {},
});
```

## 2) Prefer a visual child target

Move the gameplay root, then apply motion to a visual child.

```ts
const actorRoot = new THREE.Group();
const actorVisual = new THREE.Mesh(geometry, material);
actorRoot.add(actorVisual);

scene.add(actorRoot);
```

## 3) Apply additive effects

```ts
const fx = wisp.motion?.motion(actorVisual);

fx?.hover({ amplitude: 0.1, frequency: 1.4 });
fx?.leanByVelocity(() => velocity);
```

Trigger one-shots from gameplay events:

```ts
fx?.squash({ amount: 0.2 });
fx?.recoil(hitDirection, { distance: 0.2 });
```

## 4) Keep update order late

```ts
function tick(dt: number) {
  updateGameplay(dt);
  wisp.update(dt);
  renderer.render(scene, camera);
}
```

## Notes

- Motion is additive and non-authoritative; it removes its previous frame offset before evaluating the next one.
- Avoid applying motion directly to gameplay-collision roots unless visual movement also matches gameplay intent.
- Movement-authoring helpers are intentionally not part of Motion v1.
