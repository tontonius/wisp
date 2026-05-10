# Starter Kit Reference

Starter content now ships as modular texture and effect files so you can import only what you need.

## Exports

```ts
import { createStarterTextures, starterTextureUrls } from "@tontonius/wisp/starter/textures";
import { createStarterPresets } from "@tontonius/wisp/starter/effects";
import { createExplosionPreset } from "@tontonius/wisp/starter/effects/explosion";
```

## Included Effects

`createStarterPresets(...)` returns these names:

- `explosion`
- `muzzleFlash`
- `smokePuff`
- `hitSparks`
- `magicBurst`
- `runSmoke`
- `jumpSmokeRing`

`explosion` is authored to use the starter `smokePuffsSheet2x2` atlas by default.

## Included Textures

`createStarterTextures(...)` returns:

- `softDisc`
- `hardDisc`
- `spark`
- `smokePuffsSheet2x2`

The texture asset URLs are also exposed:

```ts
starterTextureUrls.smokePuffsSheet2x2;
```

## Fast Path (modular)

```ts
import { createStarterTextures } from "@tontonius/wisp/starter/textures";
import { createExplosionPreset } from "@tontonius/wisp/starter/effects/explosion";

const starterTextures = createStarterTextures();
const presets = {
  explosion: createExplosionPreset(starterTextures),
};
```

This keeps each effect in its own file while still giving you a simple setup path.

## Typical Usage

```ts
import * as THREE from "three";
import { Wisp } from "@tontonius/wisp";
import { createStarterTextures } from "@tontonius/wisp/starter/textures";
import { createStarterPresets } from "@tontonius/wisp/starter/effects";

const textures = createStarterTextures();
const presets = createStarterPresets(textures);

const wisp = new Wisp({
  scene,
  camera,
  particles: {
    renderer,
    presets,
  },
});

wisp.particles?.spawn("explosion", { position: [0, 0.6, 0] });
```

## Notes

- Starter textures use `THREE.SRGBColorSpace`.
- Starter textures are shipped as package assets under the starter module and loaded by URL.
- `magicBurst` requests GPU simulation; if no renderer is provided, runtime falls back to CPU using normal library fallback rules.
