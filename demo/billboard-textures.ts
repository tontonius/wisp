import * as THREE from "three";

const demoBillboardUrls = {
  smokePuff: new URL("./billboards/smoke_puff.png", import.meta.url).href,
  smokePuffSheet1x4: new URL("./billboards/1x_4_smoke_puff_sheet.png", import.meta.url).href,
  smokePuffsSheet2x1: new URL("./billboards/2x1_smoke_puffs.png", import.meta.url).href,
  smokePuffsSheet4x4: new URL("./billboards/4x4_smoke_puffs.png", import.meta.url).href,
  smokeDispersal3x4: new URL("./billboards/3x4_smoke_puff_dispersal.png", import.meta.url).href,
  leavesSpriteSheet: new URL("./billboards/leaves_sprite_sheet.png", import.meta.url).href,
  snowflakeSpriteSheet: new URL("./billboards/snowflake_sprite_sheet.png", import.meta.url).href,
  sunburst: new URL("./billboards/sunburst.png", import.meta.url).href,
} as const;

/** Same URLs as loaded by `loadDemoBillboardTextures` (Vite resolves `import.meta.url`). */
export { demoBillboardUrls };

export type DemoBillboardTextureSet = {
  smokePuff: THREE.Texture;
  smokePuffSheet1x4: THREE.Texture;
  smokePuffsSheet2x1: THREE.Texture;
  smokePuffsSheet4x4: THREE.Texture;
  smokeDispersalSheet: THREE.Texture;
  leavesSpriteSheet: THREE.Texture;
  snowflakeSpriteSheet: THREE.Texture;
  sunburst: THREE.Texture;
};

/**
 * Similar to `makeTextureFromImage(..., true)` in `main.ts`, but with a luminance cutoff:
 * near-black pixels are fully discarded while mid/bright tones keep their source alpha.
 */
function canvasTextureFromImageAlphaFromLuminance(source: CanvasImageSource): THREE.CanvasTexture {
  const BLACK_CUTOFF_LUMA = 32;

  const width =
    source instanceof HTMLImageElement
      ? source.naturalWidth
      : source instanceof SVGImageElement
        ? source.width.baseVal.value
        : source instanceof VideoFrame
          ? source.codedWidth
          : source.width;
  const height =
    source instanceof HTMLImageElement
      ? source.naturalHeight
      : source instanceof SVGImageElement
        ? source.height.baseVal.value
        : source instanceof VideoFrame
          ? source.codedHeight
          : source.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create billboard texture canvas context.");

  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    if (luminance <= BLACK_CUTOFF_LUMA) {
      data[i + 3] = 0;
      continue;
    }
    data[i + 3] = Math.round(data[i + 3]);
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function finalizeBillboardTexture(texture: THREE.Texture): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}

/**
 * Loads PNG billboards from `demo/billboards/` for use in `createDemoPresets`.
 *
 * Assets are assumed to be **white (or light) sprites on a black background** with no useful alpha channel.
 * Each image is copied to a canvas and keyed so **near-black becomes fully transparent** while
 * mid/high luminance keeps source alpha. This gives a stronger matte cutoff than straight
 * `alpha *= luminance`, which tends to over-fade dark grays.
 *
 * Sprite sheet layout (from image dimensions):
 * - `1x_4_smoke_puff_sheet.png`: 4×1 tiles (one row).
 * - `2x1_smoke_puffs.png`: 2×1 tiles (two smoke-puff variants in one row).
 * - `4x4_smoke_puffs.png`: 4×4 tiles (`stylizedExplosion`).
 * - `3x4_smoke_puff_dispersal.png`: 4×3 tiles (736÷184, 552÷184).
 * - `leaves_sprite_sheet.png` / `snowflake_sprite_sheet.png`: 4×1 tiles (2508÷627).
 * - `sunburst.png`: single radial burst art (`shockwaveSunburst`).
 */
export async function loadDemoBillboardTextures(loader: THREE.TextureLoader): Promise<DemoBillboardTextureSet> {
  const loadRaw = (url: string) =>
    new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(url, (tex: THREE.Texture) => resolve(tex), undefined, reject);
    });

  const toBillboardTexture = async (url: string): Promise<THREE.CanvasTexture> => {
    const raw = await loadRaw(url);
    const image = raw.image;
    const w = image instanceof HTMLImageElement ? image.naturalWidth : (image as ImageBitmap | undefined)?.width ?? 0;
    if (!image || w === 0) {
      raw.dispose();
      throw new Error(`Billboard image failed to decode: ${url}`);
    }
    const out = canvasTextureFromImageAlphaFromLuminance(image as CanvasImageSource);
    raw.dispose();
    return out;
  };

  const [smokePuff, smokePuffSheet1x4, smokePuffsSheet2x1, smokePuffsSheet4x4, smokeDispersalSheet, leavesSpriteSheet, snowflakeSpriteSheet, sunburst] =
    await Promise.all([
      toBillboardTexture(demoBillboardUrls.smokePuff),
      toBillboardTexture(demoBillboardUrls.smokePuffSheet1x4),
      toBillboardTexture(demoBillboardUrls.smokePuffsSheet2x1),
      toBillboardTexture(demoBillboardUrls.smokePuffsSheet4x4),
      toBillboardTexture(demoBillboardUrls.smokeDispersal3x4),
      toBillboardTexture(demoBillboardUrls.leavesSpriteSheet),
      toBillboardTexture(demoBillboardUrls.snowflakeSpriteSheet),
      toBillboardTexture(demoBillboardUrls.sunburst),
    ]);

  for (const tex of [
    smokePuff,
    smokePuffSheet1x4,
    smokePuffsSheet2x1,
    smokePuffsSheet4x4,
    smokeDispersalSheet,
    leavesSpriteSheet,
    snowflakeSpriteSheet,
    sunburst,
  ]) {
    finalizeBillboardTexture(tex);
  }

  return {
    smokePuff,
    smokePuffSheet1x4,
    smokePuffsSheet2x1,
    smokePuffsSheet4x4,
    smokeDispersalSheet,
    leavesSpriteSheet,
    snowflakeSpriteSheet,
    sunburst,
  };
}
