import type { ParticlePreset } from "../../particles/types";
import type { StarterTexturePack } from "../textures";

export function createRunSmokePreset(textures: StarterTexturePack): ParticlePreset {
  return {
    simulation: "cpu",
    simulationSpace: "world",
    maxParticles: 80,
    duration: 1,
    emitter: { type: "hemisphere", radius: 0.2, emitFrom: "volume" },
    emission: { bursts: [{ time: 0, count: [1, 3] }] },
    start: {
      lifetime: [0.6, 0.9],
      speed: [0.6, 1.8],
      size: [0.2, 0.3],
      color: ["#ffffff", "#ffffff"],
      velocity: [0, 0, 0],
      opacity: [1, 1],
      rotation: [180, 180],
      angularVelocity: 0,
    },
    forces: { acceleration: [0, 0.3, 0], drag: 2.5 },
    overLifetime: {
      size: [
        [0, 1],
        [0.6, 2],
        [1, 0],
      ],
    },
    debug: { enabled: false, emitter: true },
    renderer: {
      texture: textures.smokePuffsSheet2x2,
      textureSheet: { columns: 2, rows: 2, animationMode: "randomStart" },
      alphaFromLuminance: { enabled: true, blackCutoff: 32 },
      dispersal: {
        strength: 1,
        noiseScale: 3,
        edgeSoftness: 0.1,
        scroll: [0.04, 0.01],
        amount: [
          [0, 0],
          [0.7, 0],
          [1, 1],
        ],
      },
      blendMode: "alpha",
      depthWrite: false,
    },
  };
}
