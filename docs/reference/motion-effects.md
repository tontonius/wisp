# Motion Effects

Wisp Motion is a visual transform layer. It does not author gameplay movement.

Use it to add temporary expressive offsets (squash, recoil, hover, lean) on top of your existing object transform.

## Contract

- Gameplay code owns truth transforms (`position`, `quaternion`, `scale`).
- Motion removes its previous offset each frame, reads the current user-authored base transform, evaluates active effects, then applies a fresh offset.
- This prevents compounding drift and keeps motion additive.

Per-frame model:

```txt
remove previous offset
read base transform
evaluate active effects
compose offsets
apply offset
store offset for next frame
```

## Update Order

Run motion after gameplay and before render:

```ts
updateGameplay(dt);
wisp.update(dt);
renderer.render(scene, camera);
```

## Recommended Scene Pattern

Prefer parent/visual-child split for gameplay actors:

```ts
const playerRoot = new THREE.Group();
const playerVisual = new THREE.Mesh(geometry, material);
playerRoot.add(playerVisual);

// Game logic moves root.
playerRoot.position.x += input.x * speed * dt;

// Motion decorates visual child.
wisp.motion?.motion(playerVisual).squash().hover();
```

## API Surface

`WispOptions.motion` enables the module:

```ts
const wisp = new Wisp({
  camera,
  motion: {},
});
```

Then target objects with `wisp.motion.motion(object)`:

```ts
const fx = wisp.motion?.motion(mesh);
fx?.pop();
fx?.recoil(new THREE.Vector3(0, 0, 1));
fx?.hover({ amplitude: 0.08, frequency: 1.6 });
fx?.leanByVelocity(() => velocity);
```

Supported v1 decorator effects:

- `pop(options?)`
- `squash(options?)`
- `recoil(direction, options?)`
- `hover(options?)`
- `breathe(options?)`
- `leanByVelocity(source, options?)`

Movement-authoring APIs like `moveTo`/`followPath` are intentionally out of scope for this module.

## Composition

Effects compose in deterministic phase order:

1. persistent loops (`hover`, `breathe`)
2. response effects (`leanByVelocity`)
3. impulse effects (`recoil`)
4. one-shot effects (`pop`, `squash`)

Channel composition rules:

- position offsets: additive
- rotation offsets: quaternion multiply
- scale offsets: multiplicative
