import * as THREE from "three";

const demoBillboardUrls = {
  smokePuff: new URL("./billboards/smoke_puff.png", import.meta.url).href,
  smokePuffSheet1x4: new URL("./billboards/1x_4_smoke_puff_sheet.png", import.meta.url).href,
  smokeDispersal3x4: new URL("./billboards/3x4_smoke_puff_dispersal.png", import.meta.url).href,
  leavesSpriteSheet: new URL("./billboards/leaves_sprite_sheet.png", import.meta.url).href,
  snowflakeSpriteSheet: new URL("./billboards/snowflake_sprite_sheet.png", import.meta.url).href,
} as const;

/** Same URLs as loaded by `loadDemoBillboardTextures` (Vite resolves `import.meta.url`). */
export { demoBillboardUrls };

export type DemoBillboardTextureSet = {
  smokePuff: THREE.Texture;
  smokePuffSheet1x4: THREE.Texture;
  smokeDispersalSheet: THREE.Texture;
  leavesSpriteSheet: THREE.Texture;
  snowflakeSpriteSheet: THREE.Texture;
};

/** Matches `makeTextureFromImage(..., true)` in `main.ts`: alpha *= luminance so white-on-black mattes key out. */
function canvasTextureFromImageAlphaFromLuminance(source: CanvasImageSource): THREE.CanvasTexture {
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

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
    data[i + 3] = Math.round((data[i + 3] * luminance) / 255);
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
 * Each image is copied to a canvas and **alpha is set from luminance** (same idea as the editor’s
 * “alpha from luminance” custom image path), so black keys out and the sprite edges fade correctly.
 *
 * Sprite sheet layout (from image dimensions):
 * - `1x_4_smoke_puff_sheet.png`: 4×1 tiles (one row).
 * - `3x4_smoke_puff_dispersal.png`: 4×3 tiles (736÷184, 552÷184).
 * - `leaves_sprite_sheet.png` / `snowflake_sprite_sheet.png`: 4×1 tiles (2508÷627).
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

  const [smokePuff, smokePuffSheet1x4, smokeDispersalSheet, leavesSpriteSheet, snowflakeSpriteSheet] =
    await Promise.all([
      toBillboardTexture(demoBillboardUrls.smokePuff),
      toBillboardTexture(demoBillboardUrls.smokePuffSheet1x4),
      toBillboardTexture(demoBillboardUrls.smokeDispersal3x4),
      toBillboardTexture(demoBillboardUrls.leavesSpriteSheet),
      toBillboardTexture(demoBillboardUrls.snowflakeSpriteSheet),
    ]);

  for (const tex of [smokePuff, smokePuffSheet1x4, smokeDispersalSheet, leavesSpriteSheet, snowflakeSpriteSheet]) {
    finalizeBillboardTexture(tex);
  }

  return { smokePuff, smokePuffSheet1x4, smokeDispersalSheet, leavesSpriteSheet, snowflakeSpriteSheet };
}
