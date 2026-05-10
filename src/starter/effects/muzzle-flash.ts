import type { ParticlePreset } from "../../particles/types";
import type { StarterTexturePack } from "../textures";

export function createMuzzleFlashPreset(textures: StarterTexturePack): ParticlePreset {
  return {
    maxParticles: 40,
    duration: 0.12,
    emitter: { type: "cone", radius: 0.03, angle: 14, length: 1 },
    emission: { bursts: [{ time: 0, count: [10, 18] }] },
    start: {
      lifetime: [0.035, 0.1],
      speed: [3, 7],
      size: [1.8, 2.24],
      color: ["#fff7cc", "#ff8a22"],
      opacity: 1,
      rotation: 0,
      angularVelocity: [-1031, 1031],
    },
    forces: { drag: 10 },
    overLifetime: {
      size: [[0, 1], [1, 0]],
      opacity: [[0, 1], [1, 0]],
      color: [[0, "#ffffff"], [0.45, "#ffaa22"], [1, "#ff3300"]],
    },
    renderer: { texture: textures.spark, blendMode: "additive", align: "velocity", depthWrite: false },
  };
}
