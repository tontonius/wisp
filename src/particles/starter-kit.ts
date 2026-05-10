import * as THREE from "three";
import type { ParticlePreset } from "./types";

export const starterBillboardUrls = {
  smokePuffsSheet4x4: "demo/billboards/4x4_smoke_puffs.png",
} as const;

export type StarterTexturePack = {
  softDisc: THREE.Texture;
  hardDisc: THREE.Texture;
  spark: THREE.Texture;
  smokePuffsSheet4x4: THREE.Texture;
};

export type StarterEffectName = "explosion" | "muzzleFlash" | "smokePuff" | "hitSparks" | "magicBurst" | "runSmoke" | "jumpSmokeRing";

export type StarterKit = {
  textures: StarterTexturePack;
  presets: Record<StarterEffectName, ParticlePreset>;
};

function finalizeTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeSoftDiscTexture(size = 128): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create soft-disc texture canvas context.");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return finalizeTexture(new THREE.CanvasTexture(canvas));
}

function makeHardDiscTexture(size = 128): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create hard-disc texture canvas context.");
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  return finalizeTexture(new THREE.CanvasTexture(canvas));
}

function makeSparkTexture(size = 128): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create spark texture canvas context.");
  ctx.translate(size / 2, size / 2);
  const gradient = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(-size / 2, -3, size, 6);
  return finalizeTexture(new THREE.CanvasTexture(canvas));
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function makeSmokePuffsSheetTexture(cellSize = 128): THREE.Texture {
  const columns = 4;
  const rows = 4;
  const canvas = document.createElement("canvas");
  canvas.width = cellSize * columns;
  canvas.height = cellSize * rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create smoke-puff texture canvas context.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let frame = 0; frame < columns * rows; frame++) {
    const random = seededRandom(0x9e3779b9 + frame * 97);
    const column = frame % columns;
    const row = Math.floor(frame / columns);
    const x = column * cellSize;
    const y = row * cellSize;
    const puffCount = 5 + Math.floor(random() * 5);

    for (let i = 0; i < puffCount; i++) {
      const cx = x + cellSize * (0.34 + random() * 0.32);
      const cy = y + cellSize * (0.34 + random() * 0.32);
      const radius = cellSize * (0.18 + random() * 0.24);
      const alpha = 0.34 + random() * 0.32;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.45})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
  }

  return finalizeTexture(new THREE.CanvasTexture(canvas));
}

export function createStarterTextures(options?: { loader?: THREE.TextureLoader; textureSize?: number }): StarterTexturePack {
  const textureSize = options?.textureSize ?? 128;

  return {
    softDisc: makeSoftDiscTexture(textureSize),
    hardDisc: makeHardDiscTexture(textureSize),
    spark: makeSparkTexture(textureSize),
    smokePuffsSheet4x4: makeSmokePuffsSheetTexture(textureSize),
  };
}

export function createStarterPresets(textures: StarterTexturePack): Record<StarterEffectName, ParticlePreset> {
  const { softDisc, hardDisc, spark, smokePuffsSheet4x4 } = textures;
  return {
    explosion: {
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
        texture: smokePuffsSheet4x4,
        textureSheet: { columns: 4, rows: 4, animationMode: "randomStart" },
        alphaFromLuminance: { enabled: true, blackCutoff: 32 },
        blendMode: "alpha",
        depthWrite: false,
      },
    },
    muzzleFlash: {
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
      renderer: { texture: spark, blendMode: "additive", align: "velocity", depthWrite: false },
    },
    smokePuff: {
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
      renderer: { texture: softDisc, blendMode: "alpha", depthWrite: false, softParticles: true, softness: 1.5 },
    },
    hitSparks: {
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
      renderer: { texture: spark, blendMode: "additive", align: "velocity", depthWrite: false },
    },
    magicBurst: {
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
      renderer: { texture: hardDisc, blendMode: "additive", depthWrite: false },
    },
    runSmoke: {
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
        // overLifetime.rotation is not part of ParticlePreset; keep spin fixed at spawn orientation.
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
        texture: smokePuffsSheet4x4,
        textureSheet: { columns: 4, rows: 4, animationMode: "randomStart" },
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
    },
    jumpSmokeRing: {
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
        texture: smokePuffsSheet4x4,
        textureSheet: { columns: 4, rows: 4, animationMode: "randomStart" },
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
    },
  };
}

export function createStarterKit(options?: { loader?: THREE.TextureLoader; textureSize?: number }): StarterKit {
  const textures = createStarterTextures(options);
  return {
    textures,
    presets: createStarterPresets(textures),
  };
}
