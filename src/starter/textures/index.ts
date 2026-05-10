import * as THREE from "three";

export const starterTextureUrls = {
  softDisc: new URL("../assets/soft-disc.svg", import.meta.url).toString(),
  hardDisc: new URL("../assets/hard-disc.svg", import.meta.url).toString(),
  spark: new URL("../assets/spark-strip.svg", import.meta.url).toString(),
  smokePuffsSheet2x2: new URL("../assets/smoke-puffs-2x2.png", import.meta.url).toString(),
} as const;

export type StarterTexturePack = {
  softDisc: THREE.Texture;
  hardDisc: THREE.Texture;
  spark: THREE.Texture;
  smokePuffsSheet2x2: THREE.Texture;
};

function finalizeTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function loadTexture(loader: THREE.TextureLoader, url: string): THREE.Texture {
  const texture = loader.load(url, (loaded) => {
    finalizeTexture(loaded);
  });
  return finalizeTexture(texture);
}

export function createStarterTextures(options?: { loader?: THREE.TextureLoader }): StarterTexturePack {
  const loader = options?.loader ?? new THREE.TextureLoader();
  return {
    softDisc: loadTexture(loader, starterTextureUrls.softDisc),
    hardDisc: loadTexture(loader, starterTextureUrls.hardDisc),
    spark: loadTexture(loader, starterTextureUrls.spark),
    smokePuffsSheet2x2: loadTexture(loader, starterTextureUrls.smokePuffsSheet2x2),
  };
}
