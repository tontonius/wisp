import type { ParticlePreset } from "../../particles/types";
import type { StarterTexturePack } from "../textures";

export function createHitSparksPreset(textures: StarterTexturePack): ParticlePreset {
  return {
    maxParticles: 180,
    duration: 0.22,
    emitter: { type: "hemisphere", radius: 0.03, emitFrom: "shell" },
    emission: { bursts: [{ time: 0, count: [18, 32] }] },
    start: {
      lifetime: [0.18, 0.5],
      speed: [1.6, 4.4],
      size: [0.16, 0.3],
      color: ["#fff0bd", "#ff6f40"],
      opacity: [0.75, 1],
      velocity: [[-1.2, 1.8, -1.2], [1.2, 2.6, 1.2]],
    },
    forces: { acceleration: [0, -7.4, 0], drag: 0.55 },
    overLifetime: {
      size: [[0, 0.8], [0.2, 1.2], [1, 0]],
      opacity: [[0, 0], [0.04, 1], [0.72, 0.9], [1, 0]],
      color: [[0, "#fff9df"], [0.35, "#ffb255"], [0.75, "#ff5a2e"], [1, "#2b0f08"]],
    },
    renderer: { texture: textures.spark, blendMode: "additive", align: "velocity", depthWrite: false },
  };
}
