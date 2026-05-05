# Starter Kit Reference

The starter kit ships ready-to-use textures and presets so you can register effects and spawn them immediately.

## Exports

```ts
import {
  createStarterTextures,
  createStarterPresets,
  createStarterKit,
  starterBillboardUrls,
} from "@tontonius/wisp";
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

`explosion` is authored to use the bundled `4x4_smoke_puffs.png` atlas by default.

## Included Textures

`createStarterTextures(...)` returns:

- `softDisc` (generated radial falloff)
- `hardDisc` (generated hard circular disc)
- `spark` (generated streak/spark strip)
- `smokePuffsSheet4x4` (bundled billboard atlas)

The billboard file URL is also exposed directly:

```ts
starterBillboardUrls.smokePuffsSheet4x4;
```

## Fast Path (one call)

```ts
const { presets } = createStarterKit();
```

This creates textures and returns a `presets` object that can be passed into `Wisp`.

## Typical Usage

```ts
import * as THREE from "three";
import { Wisp, createStarterKit } from "@tontonius/wisp";

const wisp = new Wisp({
  scene,
  camera,
  particles: {
    renderer,
    presets: createStarterKit().presets,
  },
});

wisp.particles?.spawn("explosion", { position: [0, 0.6, 0] });
```

## Notes

- Starter textures use `THREE.SRGBColorSpace`.
- The smoke atlas is loaded through `THREE.TextureLoader`.
- `magicBurst` requests GPU simulation; if no renderer is provided, runtime falls back to CPU using normal library fallback rules.
