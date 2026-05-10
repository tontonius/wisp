import type { ParticlePreset } from "../../particles/types";
import type { StarterTexturePack } from "../textures";
import { createExplosionPreset } from "./explosion";
import { createHitSparksPreset } from "./hit-sparks";
import { createJumpSmokeRingPreset } from "./jump-smoke-ring";
import { createMagicBurstPreset } from "./magic-burst";
import { createMuzzleFlashPreset } from "./muzzle-flash";
import { createRunSmokePreset } from "./run-smoke";
import { createSmokePuffPreset } from "./smoke-puff";
import type { StarterEffectFactory, StarterEffectName } from "./types";

export type { StarterEffectFactory, StarterEffectName } from "./types";
export { createExplosionPreset } from "./explosion";
export { createMuzzleFlashPreset } from "./muzzle-flash";
export { createSmokePuffPreset } from "./smoke-puff";
export { createHitSparksPreset } from "./hit-sparks";
export { createMagicBurstPreset } from "./magic-burst";
export { createRunSmokePreset } from "./run-smoke";
export { createJumpSmokeRingPreset } from "./jump-smoke-ring";

export const starterEffects: Record<StarterEffectName, StarterEffectFactory> = {
  explosion: createExplosionPreset,
  muzzleFlash: createMuzzleFlashPreset,
  smokePuff: createSmokePuffPreset,
  hitSparks: createHitSparksPreset,
  magicBurst: createMagicBurstPreset,
  runSmoke: createRunSmokePreset,
  jumpSmokeRing: createJumpSmokeRingPreset,
};

export function createStarterPresets(textures: StarterTexturePack): Record<StarterEffectName, ParticlePreset> {
  return {
    explosion: starterEffects.explosion(textures),
    muzzleFlash: starterEffects.muzzleFlash(textures),
    smokePuff: starterEffects.smokePuff(textures),
    hitSparks: starterEffects.hitSparks(textures),
    magicBurst: starterEffects.magicBurst(textures),
    runSmoke: starterEffects.runSmoke(textures),
    jumpSmokeRing: starterEffects.jumpSmokeRing(textures),
  };
}
