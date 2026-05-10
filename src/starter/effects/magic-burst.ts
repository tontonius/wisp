import type { ParticlePreset } from "../../particles/types";
import type { StarterTexturePack } from "../textures";

export function createMagicBurstPreset(textures: StarterTexturePack): ParticlePreset {
  return {
    simulation: "gpu",
    maxParticles: 2200,
    duration: 0.8,
    emitter: { type: "sphere", radius: 0.1, emitFrom: "volume" },
    emission: { rateOverTime: 420, bursts: [{ time: 0, count: [36, 64] }] },
    start: {
      lifetime: [0.35, 0.9],
      speed: [0.45, 2.8],
      size: [0.05, 0.2],
      color: ["#d6f0ff", "#b193ff"],
      opacity: [0.45, 0.92],
      velocity: [[-0.8, 0.3, -0.8], [0.8, 2.0, 0.8]],
      rotation: [0, 360],
      angularVelocity: [-229, 229],
    },
    forces: { drag: 1.8, noise: { strength: 0.35, frequency: 7 } },
    overLifetime: {
      size: [[0, 0.25], [0.2, 1], [1, 0]],
      opacity: [[0, 0], [0.08, 1], [0.72, 0.5], [1, 0]],
      color: [[0, "#eef7ff"], [0.38, "#b69cff"], [1, "#4a2c8f"]],
    },
    renderer: { texture: textures.hardDisc, blendMode: "additive", depthWrite: false },
  };
}
