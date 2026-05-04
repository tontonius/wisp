import * as THREE from "three";
import type { ParticlePreset } from "../src";

export type DemoEffectName =
  | "muzzleFlash"
  | "bulletImpactSparks"
  | "explosion"
  | "smokePuff"
  | "pickupSparkle"
  | "torchFire"
  | "stretchedBillboardDemo"
  | "floorBounceDemo"
  | "sphereCollisionDemo"
  | "boxCollisionDemo"
  | "onBirthSubEmittersDemo"
  | "onDeathSubEmittersDemo"
  | "onCollisionSubEmittersDemo"
  | "rainGpu"
  | "snowGpu"
  | "magicAuraGpu"
  | "magicAura"
  | "tornadoDemo"
  | "orbitingEmitterWorldDemo"
  | "shockwave"
  | "gpuMagicStorm"
  | "candyVortex"
  | "speedVisualDemo"
  | "customEffect"
  | "explosionCombo";

type DemoPresetTextures = {
  softDisc: THREE.Texture;
  hardDisc: THREE.Texture;
  spark: THREE.Texture;
};

export const sphereCollisionCenter: [number, number, number] = [0, 1.2, 0];
export const sphereCollisionRadius = 0.72;
export const boxCollisionCenter: [number, number, number] = [1.2, 0.45, 0];
export const boxCollisionSize: [number, number, number] = [1.4, 1.2, 1.4];

export function createDemoPresets(textures: DemoPresetTextures): {
  worldPresets: Record<string, ParticlePreset>;
  editablePresets: Partial<Record<DemoEffectName, ParticlePreset>>;
} {
  const { softDisc, hardDisc, spark } = textures;

  const muzzleFlash: ParticlePreset = {
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
      rotation: [0, 0],
      angularVelocity: [-18, 18],
    },
    forces: { drag: 10 },
    overLifetime: {
      size: [[0, 1], [1, 0]],
      opacity: [[0, 1], [1, 0]],
      color: [[0, "#ffffff"], [0.45, "#ffaa22"], [1, "#ff3300"]],
    },
    renderer: { texture: spark, blendMode: "additive", align: "velocity", depthWrite: false },
  };

  const bulletImpactSparks: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 420,
    duration: 0.24,
    emitter: { type: "hemisphere", radius: 0.03, emitFrom: "shell" },
    emission: { bursts: [{ time: 0, count: [16, 28] }] },
    start: {
      lifetime: [0.2, 0.55],
      speed: [1.2, 3.6],
      size: [0.2, 0.3],
      color: ["#ffe9b0", "#ff6a3f"],
      opacity: [0.7, 1],
      velocity: [[-1.1, 2, -1.1], [1.1, 2.4, 1.1]],
    },
    forces: { acceleration: [0, -6.2, 0], drag: 0.5, noise: { strength: 0.22, frequency: 6.8 } },
    overLifetime: {
      size: [[0, 0.5], [0.2, 1.2], [1, 0]],
      opacity: [[0, 0], [0.04, 1], [0.72, 0.9], [1, 0]],
      color: [[0, "#fff9df"], [0.35, "#ffb255"], [0.75, "#ff5a2e"], [1, "#2b0f08"]],
    },
    renderer: { texture: spark, blendMode: "additive", align: "velocity", depthWrite: false },
  };

  const smokePuff: ParticlePreset = {
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
      rotation: [0, Math.PI * 2],
      angularVelocity: [-1.5, 1.5],
    },
    forces: { acceleration: [0, 0.25, 0], drag: 1.35, noise: { strength: 0.5, frequency: 4 } },
    overLifetime: {
      size: [[0, 0.15], [0.25, 1], [1, 1.9]],
      opacity: [[0, 0], [0.14, 1], [1, 0]],
      color: [[0, "#aaaaaa"], [1, "#252832"]],
    },
    renderer: { texture: softDisc, blendMode: "alpha", depthWrite: false, softParticles: true, softness: 1.5 },
  };

  const pickupSparkle: ParticlePreset = {
    maxParticles: 160,
    duration: 0.55,
    emitter: { type: "sphere", radius: 0.45, emitFrom: "shell" },
    emission: { bursts: [{ time: 0, count: [46, 70] }, { time: 0.18, count: [18, 26] }] },
    start: {
      lifetime: [0.45, 1],
      speed: [0.8, 2.6],
      size: [0.045, 0.16],
      color: ["#ffffff", "#7df9ff"],
      opacity: [0.65, 1],
      velocity: [[-0.45, 0.85, -0.45], [0.45, 2.2, 0.45]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-9, 9],
    },
    forces: { acceleration: [0, 1.8, 0], drag: 2.1, noise: { strength: 0.25, frequency: 8 } },
    overLifetime: {
      size: [[0, 0], [0.18, 1.25], [1, 0]],
      opacity: [[0, 0], [0.12, 1], [0.78, 1], [1, 0]],
      color: [[0, "#ffffff"], [0.45, "#7df9ff"], [1, "#ffec8a"]],
    },
    renderer: { texture: spark, blendMode: "additive", align: "velocity", depthWrite: false },
  };

  const torchFire: ParticlePreset = {
    maxParticles: 260,
    duration: 2,
    loop: true,
    prewarm: true,
    autoDispose: false,
    emitter: { type: "cone", radius: 0.18, angle: 20, length: 1.4 },
    emission: { rateOverTime: 115 },
    start: {
      lifetime: [0.45, 1.05],
      speed: [0.55, 1.8],
      size: [0.12, 0.42],
      color: ["#fff4ad", "#ff6a22"],
      opacity: [0.5, 0.95],
      velocity: [[-0.18, 0.8, -0.18], [0.18, 2.15, 0.18]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-2.4, 2.4],
    },
    forces: { acceleration: [0, 1.15, 0], drag: 1.4, noise: { strength: 0.42, frequency: 7.5 } },
    overLifetime: {
      size: [[0, 0.35], [0.3, 1], [1, 0.12]],
      opacity: [[0, 0], [0.08, 1], [0.7, 0.65], [1, 0]],
      color: [[0, "#fff8c8"], [0.35, "#ff9f1c"], [0.72, "#e53e1b"], [1, "#2b1209"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  const stretchedBillboardDemo: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 220,
    duration: 1.4,
    loop: true,
    prewarm: false,
    autoDispose: false,
    emitter: { type: "cone", radius: 0.5, angle: 0, length: 1.3 },
    emission: { rateOverTime: [10, 15] },
    start: {
      lifetime: [0.35, 0.8],
      speed: [0.5, 20.5],
      size: [0.05, 0.1],
      color: ["#b7f0ff", "#5eb7ff"],
      opacity: [0.4, 0.9],
      velocity: [[0, 0.4, 0], [0, 1.6, 0]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-0.2, 0.2],
    },
    forces: { acceleration: [0, 0, 0], drag: 2.12 },
    overLifetime: {
      size: [[0, 0.8], [0.5, 1], [1, 0.25]],
      opacity: [[0, 0], [0.08, 1], [0.75, 0.85], [1, 0]],
      color: [[0, "#ffffff"], [0.42, "#82d7ff"], [1, "#4d95ff"]],
    },
    renderer: {
      type: "stretchedBillboard",
      stretchFactor: 2,
      stretchMaxScale: 14.8,
      texture: hardDisc,
      blendMode: "additive",
      align: "velocity",
      depthWrite: false,
    },
  };

  const magicAura: ParticlePreset = {
    maxParticles: 180,
    duration: 2,
    loop: true,
    prewarm: true,
    autoDispose: false,
    emitter: { type: "hemisphere", radius: 1.5, emitFrom: "shell" },
    emission: { rateOverTime: 45 },
    start: {
      lifetime: [1.2, 2.2],
      speed: [0.05, 0.25],
      size: [0.05, 0.18],
      color: ["#80e8ff", "#b388ff"],
      opacity: [0.35, 0.8],
      velocity: [[-0.2, 0.2, -0.2], [0.2, 0.9, 0.2]],
    },
    forces: { drag: 0.1, noise: { strength: 0.18, frequency: 6 } },
    overLifetime: {
      size: [[0, 0], [0.2, 1], [1, 0]],
      opacity: [[0, 0], [0.2, 1], [1, 0]],
      color: [[0, "#ffffff"], [0.5, "#66d9ff"], [1, "#8e5cff"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  const tornadoDemo: ParticlePreset = {
    simulation: "gpu",
    simulationSpace: "world",
    maxParticles: 9000,
    duration: 8,
    loop: true,
    prewarm: true,
    autoDispose: false,
    bounds: { center: [0, 3, 0], radius: 8 },
    gpu: { maxSpawnPerFrame: 700 },
    emitter: { type: "cone", radius: 1.6, angle: 10, length: 6.4 },
    emission: { rateOverTime: 1600 },
    start: {
      lifetime: [2.6, 4.8],
      speed: [0.1, 0.9],
      size: [0.05, 0.18],
      color: ["#c9d0d8", "#6a727d"],
      opacity: [0.15, 0.5],
      velocity: [[-0.4, 1.6, -0.4], [0.4, 4.4, 0.4]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-2.2, 2.2],
    },
    forces: {
      acceleration: [0, 0.45, 0],
      drag: 0.22,
      vortex: {
        center: [0, 2.6, 0],
        axis: [0, 1, 0],
        orbitalSpeed: 10.5,
        inward: 3.4,
        upward: 1.15,
      },
      noise: {
        strength: 0.38,
        frequency: 0.42,
        scroll: [0.08, 0.32, 0.07],
        octaves: 2,
        lacunarity: 2,
        persistence: 0.5,
      },
    },
    overLifetime: {
      size: [[0, 0.24], [0.2, 1], [0.7, 1.45], [1, 0.52]],
      opacity: [[0, 0], [0.08, 1], [0.84, 0.78], [1, 0]],
      color: [[0, "#e4ebf3"], [0.35, "#9aa4b1"], [1, "#474f58"]],
    },
    renderer: { texture: softDisc, blendMode: "alpha", depthWrite: false, depthTest: true },
  };

  const orbitingEmitterWorldDemo: ParticlePreset = {
    simulation: "cpu",
    simulationSpace: "world",
    maxParticles: 700,
    duration: 10,
    loop: true,
    prewarm: false,
    autoDispose: false,
    emitter: { type: "sphere", radius: 0.14, emitFrom: "volume" },
    emission: { rateOverTime: 95 },
    start: {
      lifetime: [2.2, 4.2],
      speed: [0.03, 0.18],
      size: [0.16, 0.34],
      color: ["#ffffff", "#ffffff"],
      opacity: [0.22, 0.52],
      velocity: [[-0.08, 0, -0.08], [0.08, 0, 0.08]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-0.45, 0.45],
    },
    forces: {
      acceleration: [0, 0.25, 0],
      drag: 1.15,
      noise: { strength: 0.15, frequency: 1.6 },
    },
    overLifetime: {
      size: [[0, 0.45], [0.08, 1], [0.72, 1.85], [1, 2.3]],
      opacity: [[0, 0], [0.08, 1], [0.62, 0.82], [1, 0]],
      color: [[0, "#2a2d33"], [0.25, "#a99c8c"], [1, "#ffffff"]],
    },
    renderer: { texture: softDisc, blendMode: "alpha", depthWrite: false, depthTest: true },
  };

  const floorBounceDemo: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 220,
    duration: 2.4,
    loop: true,
    prewarm: false,
    autoDispose: false,
    emitter: { type: "cone", radius: 0.1, angle: 45, length: 1 },
    emission: { rateOverTime: [52, 78] },
    collision: {
      type: "plane",
      y: 0,
      bounce: 0.48,
      dampening: 0.78,
      killOnCollision: false,
    },
    start: {
      lifetime: [2.2, 3.6],
      speed: [0.75, 2.1],
      size: [0.055, 0.13],
      color: ["#d4f0ff", "#6ec8ff"],
      opacity: [0.5, 0.92],
      velocity: [[-0.95, 2.8, -0.95], [0.95, 4.4, 0.95]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-2.8, 2.8],
    },
    forces: { acceleration: [0, -6, 0], drag: 0.12, noise: { strength: 0.1, frequency: 4.5 } },
    overLifetime: {
      size: [[0, 0.3], [0.22, 1], [1, 0.88]],
      opacity: [[0, 0], [0.06, 1], [0.85, 1], [1, 0]],
      color: [[0, "#ffffff"], [0.35, "#9fe0ff"], [1, "#5aa8ff"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  const sphereCollisionDemo: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 240,
    duration: 2.6,
    loop: true,
    prewarm: false,
    autoDispose: false,
    emitter: { type: "cone", radius: 0.05, angle: 20, length: 1 },
    emission: { rateOverTime: [58, 84] },
    collision: {
      type: "sphere",
      center: sphereCollisionCenter,
      radius: sphereCollisionRadius,
      bounce: 1,
      dampening: 0.82,
      killOnCollision: false,
    },
    start: {
      lifetime: [1.6, 2.6],
      speed: [0.7, 1.8],
      size: [0.045, 0.11],
      color: ["#f7fbff", "#94d8ff"],
      opacity: [0.5, 0.9],
      velocity: [[-1.2, -0.2, -1.2], [1.2, 1.9, 1.2]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-2.4, 2.4],
    },
    forces: { acceleration: [0, -3.5, 0], drag: 0.1 },
    overLifetime: {
      size: [[0, 0.45], [0.25, 1], [1, 0.82]],
      opacity: [[0, 0], [0.08, 1], [0.88, 0.95], [1, 0]],
      color: [[0, "#ffffff"], [0.42, "#b9e7ff"], [1, "#66b9ff"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  const boxCollisionDemo: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 260,
    duration: 2.8,
    loop: true,
    prewarm: false,
    autoDispose: false,
    emitter: { type: "cone", radius: 0.03, angle: 10, length: 0.6 },
    emission: { rateOverTime: [64, 92] },
    collision: {
      type: "box",
      center: boxCollisionCenter,
      size: boxCollisionSize,
      bounce: 0.02,
      dampening: 0.8,
      killOnCollision: false,
    },
    start: {
      lifetime: [1.9, 3.1],
      speed: [0.05, 0.18],
      size: [0.04, 0.12],
      color: ["#fff8df", "#ffb57a"],
      opacity: [0.45, 0.9],
      velocity: [[2.4, -0.18, -0.35], [3.4, 0.28, 0.35]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-2.6, 2.6],
    },
    forces: { acceleration: [0, -1.2, 0], drag: 0.08, noise: { strength: 0.06, frequency: 4.2 } },
    overLifetime: {
      size: [[0, 0.5], [0.22, 1], [1, 0.86]],
      opacity: [[0, 0], [0.08, 1], [0.86, 0.95], [1, 0]],
      color: [[0, "#fffef7"], [0.4, "#ffd7a1"], [1, "#ff8c52"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  const onDeathSubEmitterChild: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 240,
    duration: 0.4,
    emitter: { type: "sphere", radius: 0.03, emitFrom: "volume" },
    emission: { bursts: [{ time: 0, count: [14, 24] }] },
    start: {
      lifetime: [0.32, 0.75],
      speed: [0.9, 2.8],
      size: [0.08, 0.2],
      color: ["#fff9cf", "#ff8a47"],
      opacity: [1, 1],
      velocity: [[-0.65, 0.4, -0.65], [0.65, 2.4, 0.65]],
    },
    forces: { acceleration: [0, -10, 0], drag: 1.2, noise: { strength: 0.35, frequency: 7.5 } },
    overLifetime: {
      size: [[0, 0.7], [0.22, 1.35], [1, 0]],
      opacity: [[0, 0], [0.04, 1], [0.68, 0.95], [1, 0]],
      color: [[0, "#fffde8"], [0.35, "#ffb163"], [0.75, "#ff6a2a"], [1, "#2e0f08"]],
    },
    renderer: { texture: spark, blendMode: "additive", align: "velocity", depthWrite: false },
  };

  const onDeathSubEmittersDemo: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 180,
    duration: 0.45,
    loop: false,
    emitter: { type: "cone", radius: 0.22, angle: 45, length: 1 },
    emission: { bursts: [{ time: 0, count: [46, 68] }] },
    start: {
      lifetime: [0.58, 0.8],
      speed: [0.9, 1.1],
      size: [0.08, 0.18],
      color: ["#e8f7ff", "#7ecfff"],
      opacity: [0.65, 1],
      velocity: [[-0.55, 0.65, -0.55], [0.55, 1.8, 0.55]],
    },
    forces: { acceleration: [0, 1.1, 0], drag: 0.3, noise: { strength: 0.15, frequency: 5 } },
    overLifetime: {
      size: [[0, 1.2], [0.75, 0.95], [1, 0.35]],
      opacity: [[0, 0], [0.08, 1], [0.88, 1], [1, 0]],
      color: [[0, "#ffffff"], [0.45, "#8ed7ff"], [1, "#3f87ff"]],
    },
    subEmitters: { onDeath: "onDeathSubEmitterChild" },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  const onBirthSubEmitterChild: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 420,
    duration: 0.24,
    emitter: { type: "sphere", radius: 0.03, emitFrom: "volume" },
    emission: { bursts: [{ time: 0, count: [16, 28] }] },
    start: {
      lifetime: [0.2, 0.55],
      speed: [1.2, 3.6],
      size: [0.05, 0.14],
      color: ["#ffe9b0", "#ff6a3f"],
      opacity: [0.7, 1],
      velocity: [[-1.1, 0.2, -1.1], [1.1, 2.4, 1.1]],
    },
    forces: { acceleration: [0, -6.2, 0], drag: 1.05, noise: { strength: 0.22, frequency: 6.8 } },
    overLifetime: {
      size: [[0, 0.5], [0.2, 1.2], [1, 0]],
      opacity: [[0, 0], [0.04, 1], [0.72, 0.9], [1, 0]],
      color: [[0, "#fff9df"], [0.35, "#ffb255"], [0.75, "#ff5a2e"], [1, "#2b0f08"]],
    },
    renderer: { texture: spark, blendMode: "additive", align: "velocity", depthWrite: false },
  };

  const onBirthSubEmittersDemo: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 260,
    duration: 1.7,
    loop: true,
    prewarm: false,
    autoDispose: false,
    emitter: { type: "cone", radius: 0.24, angle: 52, length: 1.25 },
    emission: { rateOverTime: [48, 72] },
    subEmitters: { onBirth: "onBirthSubEmitterChild" },
    start: {
      lifetime: [0.6, 1.25],
      speed: [0.35, 1.2],
      size: [0.06, 0.15],
      color: ["#fff7d9", "#ffa24f"],
      opacity: [0.5, 0.95],
      velocity: [[-0.45, 0.65, -0.45], [0.45, 2.15, 0.45]],
    },
    forces: { acceleration: [0, 0.95, 0], drag: 0.28, noise: { strength: 0.14, frequency: 5.6 } },
    overLifetime: {
      size: [[0, 0.45], [0.3, 1], [1, 0.2]],
      opacity: [[0, 0], [0.07, 1], [0.82, 0.9], [1, 0]],
      color: [[0, "#fffde7"], [0.35, "#ffbf66"], [0.72, "#ff7633"], [1, "#3a170e"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false, align: "velocity" },
  };

  const onCollisionSubEmitterChild: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 320,
    duration: 0.24,
    emitter: { type: "sphere", radius: 0.02, emitFrom: "volume" },
    emission: { bursts: [{ time: 0, count: [16, 28] }] },
    start: {
      lifetime: [0.2, 0.52],
      speed: [1.6, 3.8],
      size: [0.05, 0.13],
      color: ["#dff6ff", "#6ec8ff"],
      opacity: [0.65, 1],
      velocity: [[-1.35, 0.2, -1.35], [1.35, 1.55, 1.35]],
    },
    forces: { acceleration: [0, -8.4, 0], drag: 1.35, noise: { strength: 0.08, frequency: 5.5 } },
    overLifetime: {
      size: [[0, 0.55], [0.22, 1], [1, 0]],
      opacity: [[0, 0], [0.04, 1], [0.72, 0.85], [1, 0]],
      color: [[0, "#ffffff"], [0.38, "#8fddff"], [0.78, "#4fb2ff"], [1, "#0f4a88"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", align: "velocity", depthWrite: false },
  };

  const onCollisionSubEmittersDemo: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 180,
    duration: 2.2,
    loop: true,
    prewarm: false,
    autoDispose: false,
    emitter: { type: "cone", radius: 0.09, angle: 42, length: 1 },
    emission: { bursts: [{ time: 0, count: [42, 64] }] },
    collision: {
      type: "plane",
      y: 0,
      bounce: 0.35,
      dampening: 0.72,
      killOnCollision: true,
    },
    subEmitters: { onCollision: "onCollisionSubEmitterChild" },
    start: {
      lifetime: [1.15, 1.85],
      speed: [3.9, 4.4],
      size: [0.06, 0.14],
      color: ["#cbe8ff", "#8ac9ff"],
      opacity: [0.45, 0.85],
      velocity: [[-0.95, 2.2, -0.95], [0.95, 3.8, 0.95]],
    },
    forces: { acceleration: [0, -8.4, 0], drag: 0.1, noise: { strength: 0.08, frequency: 4.5 } },
    overLifetime: {
      size: [[0, 0.4], [0.2, 1], [1, 0.85]],
      opacity: [[0, 0], [0.05, 1], [0.9, 1], [1, 0]],
      color: [[0, "#ffffff"], [0.4, "#9fdaff"], [1, "#5caaff"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  const explosion: ParticlePreset = {
    maxParticles: 220,
    duration: 0.25,
    emitter: { type: "sphere", radius: 0.12, emitFrom: "volume" },
    emission: { bursts: [{ time: 0, count: [90, 130] }] },
    start: {
      lifetime: [0.35, 1.1],
      speed: [1.5, 7],
      size: [0.05, 0.28],
      color: ["#fff4ba", "#ff4b16"],
      opacity: [0.6, 1],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-10, 10],
    },
    forces: { acceleration: [0, -1.8, 0], drag: 2.2, noise: { strength: 0.25, frequency: 7 } },
    overLifetime: {
      size: [[0, 1], [0.4, 0.7], [1, 0]],
      opacity: [[0, 1], [1, 0]],
      color: [[0, "#ffffff"], [0.22, "#ffcc33"], [0.6, "#ff4422"], [1, "#333333"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  const shockwave: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 512,
    duration: 1.25,
    loop: false,
    prewarm: false,
    autoDispose: false,
    debug: false,
    gpu: {
      maxSpawnPerFrame: 512,
    },
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
          count: [30, 40],
        },
      ],
    },
    start: {
      lifetime: [1, 1.76],
      speed: [20, 20],
      size: [1.265, 1.98],
      color: "#ffffff",
      opacity: [1, 1],
      velocity: [[-0.15, 0, -0.15], [0.15, 0, 0.15]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-1.3, 1.3],
    },
    forces: {
      acceleration: [0, 2.95, 0],
      drag: 4.52,
      noise: {
        strength: 0.28,
        frequency: 4.5,
      },
    },
    overLifetime: {
      size: [[0, 0], [0.12, 1], [1, 0]],
      opacity: [
        [0, 1],
        [0.74515625, 0.6211032653942217],
        [1, 0],
      ],
      color: [
        [0, "#ffffff"],
        [0.11036458333333334, "#fff59d"],
        [0.2570572916666667, "#f4b53f"],
        [0.4859895833333333, "#b47a2e"],
        [0.6268489583333333, "#994d34"],
        [0.828984375, "#303030"],
      ],
    },
    renderer: {
      texture: softDisc,
      blendMode: "alpha",
      align: "camera",
      depthWrite: false,
      softParticles: true,
      softness: 1.4,
    },
  };

  const shockwaveCenterExplosion: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 512,
    duration: 2,
    loop: false,
    prewarm: false,
    autoDispose: false,
    debug: false,
    gpu: {
      maxSpawnPerFrame: 512,
    },
    emitter: {
      type: "hemisphere",
      radius: 0,
      emitFrom: "volume",
    },
    emission: {
      bursts: [
        {
          time: 0,
          count: [30, 40],
        },
      ],
    },
    start: {
      lifetime: [1.54, 1.8],
      speed: [20, 20],
      size: [1.59, 1.675],
      color: "#ffffff",
      opacity: [1, 1],
      velocity: [[-3.65, 0, -3.65], [3.65, 0.9, 3.65]],
      rotation: [0, Math.PI * 2],
      angularVelocity: 0,
    },
    forces: {
      acceleration: [0, -0.45, 0],
      drag: 12.83,
      noise: {
        strength: 0.28,
        frequency: 4.5,
        scroll: [0.2, 0.35, 0.17],
        octaves: 2,
        lacunarity: 2,
        persistence: 0.5,
      },
    },
    limitVelocityOverLifetime: {
      speed: [[0, 30], [1, 0]],
      dampen: 1,
    },
    velocityOverLifetime: {
      linear: {
        x: [[0, 0], [1, 0]],
        y: [[0, 0.75], [1, -0.35]],
        z: [[0, 0], [1, 0]],
      },
    },
    rotationBySpeed: {
      speedRange: [0, 8],
      angularVelocity: [[0, 0.65], [1, 17.6]],
    },
    overLifetime: {
      size: [[0, 0], [0.18, 1], [1, 1.25]],
      opacity: [[0, 0], [0.12, 1], [0.95, 1], [1, 0]],
      color: [[0, "#ffffff"], [0.16846354166666666, "#ffec70"], [0.8229427083333334, "#a46f4c"]],
    },
    renderer: {
      texture: softDisc,
      blendMode: "alpha",
      align: "camera",
      sorting: "distance",
      depthWrite: false,
      softParticles: true,
      softness: 1.5,
    },
  };

  const shockwaveShrapnel: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 32,
    duration: 0.9,
    loop: false,
    prewarm: false,
    autoDispose: false,
    emitter: {
      type: "cone",
      radius: 0.02,
      angle: 60,
      length: 1,
    },
    emission: {
      bursts: [
        {
          time: 0,
          count: [4, 5],
        },
      ],
    },
    start: {
      lifetime: [2, 2.25],
      speed: [9.5, 13.5],
      size: [0.3, 0.55],
      color: ["#ffd88f", "#b87744"],
      opacity: [0.95, 1],
      velocity: [[-2.8, 2.8, -2.8], [2.8, 5.8, 2.8]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-18, 18],
    },
    forces: {
      acceleration: [0, -12.5, 0],
      drag: 0.8,
    },
    rotationBySpeed: {
      speedRange: [0, 14],
      angularVelocity: [[0, 1], [1, 22]],
    },
    overLifetime: {
      size: [[0, 1], [0.85, 0.9], [1, 0.35]],
      opacity: [[0, 1], [0.8, 0.85], [1, 0]],
      color: [[0, "#fff0c2"], [0.45, "#f2aa63"], [1, "#6b3d24"]],
    },
    renderer: {
      texture: hardDisc,
      blendMode: "alpha",
      align: "camera",
      depthWrite: false,
    },
  };

  const rainGpu: ParticlePreset = {
    simulation: "gpu",
    maxParticles: 12000,
    duration: 12,
    loop: true,
    prewarm: true,
    autoDispose: false,
    bounds: { center: [0, 0, 0], radius: 10 },
    gpu: { maxSpawnPerFrame: 1024 },
    emitter: { type: "box", size: [12, 0.2, 12] },
    emission: { rateOverTime: 1800 },
    start: {
      lifetime: [1.4, 2.6],
      speed: 0,
      size: [0.18, 0.28],
      color: ["#9fd3ff", "#d8f1ff"],
      opacity: [0.35, 0.75],
      velocity: [[-0.35, -8.5, -0.2], [0.35, -13, 0.2]],
      rotation: [0, 0],
    },
    forces: { acceleration: [0, -2.5, 0], drag: 0.05 },
    overLifetime: {
      opacity: [[0, 0], [0.04, 1], [0.9, 1], [1, 0]],
      color: [[0, "#ffffff"], [1, "#74bfff"]],
    },
    renderer: { texture: spark, blendMode: "alpha", align: "velocity", depthWrite: false },
  };

  const snowGpu: ParticlePreset = {
    simulation: "gpu",
    maxParticles: 10000,
    duration: 16,
    loop: true,
    prewarm: true,
    autoDispose: false,
    bounds: { center: [0, 0, 0], radius: 14 },
    gpu: { maxSpawnPerFrame: 768 },
    emitter: { type: "box", size: [12, 0.2, 12] },
    emission: { rateOverTime: 700 },
    start: {
      lifetime: [5, 9],
      speed: 0,
      size: [0.035, 0.12],
      color: ["#ffffff", "#cce9ff"],
      opacity: [0.45, 0.9],
      velocity: [[-0.45, -0.85, -0.25], [0.45, -1.8, 0.25]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-0.8, 0.8],
    },
    forces: { acceleration: [0, -0.08, 0], drag: 0.08, noise: { strength: 0.38, frequency: 1.7 } },
    overLifetime: {
      size: [[0, 0.7], [0.5, 1], [1, 0.9]],
      opacity: [[0, 0], [0.08, 1], [0.86, 1], [1, 0]],
      color: [[0, "#ffffff"], [1, "#d8f2ff"]],
    },
    renderer: { texture: softDisc, blendMode: "alpha", depthWrite: false },
  };

  const magicAuraGpu: ParticlePreset = {
    simulation: "gpu",
    maxParticles: 4096,
    duration: 5,
    loop: true,
    prewarm: true,
    autoDispose: false,
    bounds: { center: [0, 1.2, 0], radius: 6 },
    gpu: { maxSpawnPerFrame: 384 },
    emitter: { type: "hemisphere", radius: 1.65, emitFrom: "shell" },
    emission: { rateOverTime: 520 },
    start: {
      lifetime: [1.3, 2.8],
      speed: [0.05, 0.35],
      size: [0.035, 0.16],
      color: ["#69e7ff", "#c084fc"],
      opacity: [0.25, 0.8],
      velocity: [[-0.22, 0.18, -0.22], [0.22, 1.1, 0.22]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-1.2, 1.2],
    },
    forces: { drag: 0.18, noise: { strength: 0.5, frequency: 3.6 } },
    overLifetime: {
      size: [[0, 0], [0.16, 1], [0.78, 0.9], [1, 0]],
      opacity: [[0, 0], [0.16, 1], [0.82, 0.75], [1, 0]],
      color: [[0, "#ffffff"], [0.45, "#70e7ff"], [1, "#b388ff"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  const gpuMagicStorm: ParticlePreset = {
    simulation: "gpu",
    maxParticles: 8192,
    duration: 6,
    loop: true,
    prewarm: false,
    autoDispose: false,
    bounds: { center: [0, 1.5, 0], radius: 10 },
    gpu: {
      maxSpawnPerFrame: 512,
    },
    emitter: { type: "box", size: [9, 3, 9] },
    emission: { rateOverTime: 900 },
    start: {
      lifetime: [2.5, 5.5],
      speed: [0.02, 0.22],
      size: [0.025, 0.11],
      color: ["#6ee7ff", "#d8b4fe"],
      opacity: [0.25, 0.85],
      velocity: [[-0.08, 0.04, -0.08], [0.08, 0.34, 0.08]],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-0.7, 0.7],
    },
    forces: {
      drag: 0.05,
      noise: { strength: 0.35, frequency: 2.5 },
    },
    overLifetime: {
      size: [[0, 0], [0.2, 1], [0.82, 1], [1, 0]],
      opacity: [[0, 0], [0.18, 1], [0.78, 0.8], [1, 0]],
      color: [[0, "#ffffff"], [0.5, "#72e5ff"], [1, "#9b6dff"]],
    },
    renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
  };

  /** CPU: speed remaps tint, size multiplier, and spin (see `colorBySpeed` / `sizeBySpeed` / `rotationBySpeed`). */
  const speedVisualDemo: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 480,
    duration: 2.2,
    loop: true,
    emitter: { type: "box", size: [2.22, 0.22, 0.2] },
    emission: { rateOverTime: 72 },
    start: {
      lifetime: [1.5, 1.5],
      speed: [4, 7],
      size: [0.1, 0.18],
      color: "#ffffff",
      opacity: [0.75, 1],
      rotation: [0, Math.PI * 2],
      angularVelocity: [-0.2, 0.2],
    },
    forces: { drag: 1.1, acceleration: [0, -0.35, 0] },
    colorBySpeed: {
      speedRange: [0, 7],
      gradient: [
        [0, "#3d7cff"],
        [0.45, "#e8f0ff"],
        [1, "#ff5a3c"],
      ],
    },
    sizeBySpeed: {
      speedRange: [0, 7],
      curve: [
        [0, 0.45],
        [1, 2.1],
      ],
    },
    rotationBySpeed: {
      speedRange: [0, 7],
      angularVelocity: [
        [0, 0.4],
        [1, 360],
      ],
    },
    overLifetime: {
      opacity: [
        [0, 0],
        [0.08, 1],
        [1, 0],
      ],
    },
    renderer: { texture: softDisc, blendMode: "additive", align: "velocity", depthWrite: false },
  };

  /** CPU cone + vortex: soft white → cyan → pink puff on the ground plane. */
  const candyVortex: ParticlePreset = {
    simulation: "cpu",
    maxParticles: 3840,
    duration: 1.25,
    loop: true,
    prewarm: false,
    autoDispose: false,
    debug: false,
    gpu: { maxSpawnPerFrame: 512 },
    emitter: { type: "cone", radius: 0.45, angle: 21, length: 1.5 },
    emission: { rateOverTime: 304 },
    start: {
      lifetime: [3, 3],
      speed: [1, 1],
      size: [0.525, 0.785],
      color: "#ffffff",
      opacity: [1, 1],
      rotation: 0,
      angularVelocity: 0,
    },
    forces: {
      acceleration: [0, 0, 0],
      drag: 6.09,
      vortex: {
        center: [0, 14.35, 0],
        axis: [0, 1, 0],
        orbitalSpeed: 19.57,
        inward: -1.3,
        upward: 13.48,
      },
      noise: {
        strength: 0,
        frequency: 4.5,
        scroll: [0.2, 0.35, 0.17],
        octaves: 2,
        lacunarity: 2,
        persistence: 0.5,
      },
    },
    overLifetime: {
      size: [
        [0, 0],
        [0.18, 1],
        [1, 1.74],
      ],
      opacity: [
        [0, 0],
        [0.12, 1],
        [0.833046875, 1],
        [1, 0],
      ],
      color: [
        [0, "#ffffff"],
        [0.45, "#70e7ff"],
        [0.841640625, "#ffade8"],
      ],
    },
    renderer: {
      texture: softDisc,
      blendMode: "alpha",
      align: "camera",
      sorting: "distance",
      depthWrite: false,
      softParticles: true,
      softness: 2.6,
    },
  };

  const worldPresets: Record<string, ParticlePreset> = {
    muzzleFlash,
    bulletImpactSparks,
    explosion,
    smokePuff,
    pickupSparkle,
    torchFire,
    stretchedBillboardDemo,
    floorBounceDemo,
    sphereCollisionDemo,
    boxCollisionDemo,
    onBirthSubEmitterChild,
    onBirthSubEmittersDemo,
    onDeathSubEmitterChild,
    onDeathSubEmittersDemo,
    onCollisionSubEmitterChild,
    onCollisionSubEmittersDemo,
    rainGpu,
    snowGpu,
    magicAuraGpu,
    magicAura,
    tornadoDemo,
    orbitingEmitterWorldDemo,
    shockwave,
    shockwaveCenterExplosion,
    shockwaveShrapnel,
    gpuMagicStorm,
    speedVisualDemo,
    candyVortex,
  };

  const editablePresets: Partial<Record<DemoEffectName, ParticlePreset>> = {
    muzzleFlash,
    bulletImpactSparks,
    explosion,
    smokePuff,
    pickupSparkle,
    torchFire,
    stretchedBillboardDemo,
    floorBounceDemo,
    sphereCollisionDemo,
    boxCollisionDemo,
    onBirthSubEmittersDemo,
    onDeathSubEmittersDemo,
    onCollisionSubEmittersDemo,
    rainGpu,
    snowGpu,
    magicAuraGpu,
    magicAura,
    tornadoDemo,
    orbitingEmitterWorldDemo,
    shockwave,
    gpuMagicStorm,
    speedVisualDemo,
    candyVortex,
  };

  return { worldPresets, editablePresets };
}
