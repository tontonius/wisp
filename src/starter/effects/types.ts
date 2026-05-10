import type { ParticlePreset } from "../../particles/types";
import type { StarterTexturePack } from "../textures";

export type StarterEffectName = "explosion" | "muzzleFlash" | "smokePuff" | "hitSparks" | "magicBurst" | "runSmoke" | "jumpSmokeRing";

export type StarterEffectFactory = (textures: StarterTexturePack) => ParticlePreset;
