import type { ParticlePreset } from "../../particles/types";
import type { StarterTexturePack } from "../textures";

export function createSmokePuffPreset(textures: StarterTexturePack): ParticlePreset {
  return {
    maxParticles: 120,
    duration: 0.4,
    emitter: { type: "sphere", radius: 0.18, emitFrom: "volume" },
    emission: { bursts: [{ time: 0, count: [28, 42] }] },
    start: {
      lifetime: [0.8, 1.6],
      speed: [0.15, 1.1],
      size: [0.28, 0.75],
      color: ["#778090", "#c8c8c8"],
      opacity: [0.2, 0.55],
      velocity: [[-0.25, 0.5, -0.25], [0.25, 1.45, 0.25]],
      rotation: [0, 360],
      angularVelocity: [-86, 86],
    },
    forces: { acceleration: [0, 0.25, 0], drag: 1.35, noise: { strength: 0.5, frequency: 4 } },
    overLifetime: {
      size: [[0, 0.15], [0.25, 1], [1, 1.9]],
      opacity: [[0, 0], [0.14, 1], [1, 0]],
      color: [[0, "#aaaaaa"], [1, "#252832"]],
    },
    renderer: { texture: textures.softDisc, blendMode: "alpha", depthWrite: false, softParticles: true, softness: 1.5 },
  };
}
