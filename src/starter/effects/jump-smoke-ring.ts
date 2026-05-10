import type { ParticlePreset } from "../../particles/types";
import type { StarterTexturePack } from "../textures";

export function createJumpSmokeRingPreset(textures: StarterTexturePack): ParticlePreset {
  return {
    simulation: "cpu",
    maxParticles: 512,
    duration: 1.25,
    loop: false,
    prewarm: false,
    autoDispose: true,
    debug: false,
    gpu: { maxSpawnPerFrame: 512 },
    emitter: {
      type: "cone",
      radius: 0,
      angle: 89,
      length: 0.01,
    },
    emission: {
      bursts: [
        {
          time: 0,
          count: [10, 20],
        },
      ],
    },
    start: {
      lifetime: [1, 1.76],
      speed: [10, 10],
      size: [0.3, 0.4],
      color: "#ffffff",
      opacity: [1, 1],
      velocity: [[-0.15, 0, -0.15], [0.15, 0, 0.15]],
      rotation: [0, 360],
      angularVelocity: [-75, 75],
    },
    forces: {
      acceleration: [0, 2.95, 0],
      drag: 10.52,
      noise: {
        strength: 0.28,
        frequency: 4.5,
      },
    },
    overLifetime: {
      size: [[0, 0], [0.02, 1], [1, 0]],
      opacity: [
        [0, 1],
        [0.74515625, 0.6211032653942217],
        [1, 0],
      ],
    },
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
