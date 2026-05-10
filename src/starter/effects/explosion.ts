import type { ParticlePreset } from "../../particles/types";
import type { StarterTexturePack } from "../textures";

export function createExplosionPreset(textures: StarterTexturePack): ParticlePreset {
  return {
    simulation: "cpu",
    maxParticles: 240,
    duration: 0.28,
    emitter: { type: "sphere", radius: 0.12, emitFrom: "volume" },
    emission: { bursts: [{ time: 0, count: [84, 128] }] },
    start: {
      lifetime: [0.4, 1.1],
      speed: [1.6, 5.8],
      size: [0.35, 0.8],
      color: ["#fff4c5", "#ff6e2a"],
      opacity: [0.65, 1],
      velocity: [[-1.4, 0.5, -1.4], [1.4, 2.8, 1.4]],
      rotation: [0, 360],
      angularVelocity: [-143, 143],
    },
    forces: { acceleration: [0, -1.4, 0], drag: 1.7, noise: { strength: 0.35, frequency: 4.8 } },
    overLifetime: {
      size: [[0, 0.65], [0.22, 1.3], [1, 0.25]],
      opacity: [[0, 0], [0.06, 1], [0.7, 0.82], [1, 0]],
      color: [[0, "#fff6de"], [0.3, "#ffb347"], [0.7, "#ff5e2e"], [1, "#2b1309"]],
    },
    renderer: {
      texture: textures.smokePuffsSheet2x2,
      textureSheet: { columns: 2, rows: 2, animationMode: "randomStart" },
      alphaFromLuminance: { enabled: true, blackCutoff: 32 },
      blendMode: "alpha",
      depthWrite: false,
    },
  };
}
