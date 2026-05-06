import { defaultGradientStops } from "../../demo/tweakpane-gradient-plugin/index.js";

export type EditorParams = {
  presetName: string;
  simulationSpace: "local" | "world";
  simulation: "auto" | "cpu" | "gpu";
  maxParticles: number;
  duration: number;
  loop: boolean;
  prewarm: boolean;
  emitterType: "point" | "sphere" | "hemisphere" | "cone" | "box";
  emitterBoxSize: { x: number; y: number; z: number };
  emitterRadius: number;
  emitterEmitFrom: "volume" | "shell";
  emitterAngle: number;
  emitterLength: number;
  emissionMode: "rate" | "burst";
  burstCount: { x: number; y: number };
  burstTime: number;
  burstProbability: number;
  rateOverTime: number;
  lifetimeRange: { x: number; y: number };
  speedRange: { x: number; y: number };
  sizeRange: { x: number; y: number };
  opacityRange: { x: number; y: number };
  startRotationRange: { x: number; y: number };
  startAngularVelocityRange: { x: number; y: number };
  startColorMode: "single" | "range";
  startColorA: string;
  startColorB: string;
  drag: number;
  acceleration: { x: number; y: number; z: number };
  vortexEnabled: boolean;
  vortexCenter: { x: number; y: number; z: number };
  vortexAxis: { x: number; y: number; z: number };
  vortexOrbitalSpeed: number;
  vortexInward: number;
  vortexUpward: number;
  noiseEnabled: boolean;
  noiseStrength: number;
  noiseFrequency: number;
  noiseScroll: { x: number; y: number; z: number };
  noiseOctaves: number;
  noiseLacunarity: number;
  noisePersistence: number;
  velocityOverLifetimeEnabled: boolean;
  velocityLinearX: { x: number; y: number };
  velocityLinearY: { x: number; y: number };
  velocityLinearZ: { x: number; y: number };
  rendererType: "billboard" | "stretchedBillboard";
  rendererBlendMode: "alpha" | "additive" | "multiply";
  rendererAlign: "camera" | "velocity";
  rendererSorting: "none" | "distance" | "youngestFirst" | "oldestFirst";
  rendererTexture: "softDisc" | "hardDisc" | "spark";
  rendererStretchFactor: number;
  rendererStretchMaxScale: number;
  rendererDepthWrite: boolean;
  rendererDepthTest: boolean;
  rendererSoftParticles: boolean;
  rendererSoftness: number;
  rendererAlphaFromLuminanceEnabled: boolean;
  rendererAlphaFromLuminanceBlackCutoff: number;
  rendererTextureSheetEnabled: boolean;
  rendererTextureSheetTextureName: string;
  rendererTextureSheetColumns: number;
  rendererTextureSheetRows: number;
  rendererTextureSheetAnimationMode: "static" | "randomStart" | "overLifetime" | "randomStartOverLifetime";
  dispersalEnabled: boolean;
  dispersalStrength: number;
  dispersalAmount: { x: number; y: number };
  dispersalStartAt: number;
  dispersalNoiseScale: number;
  dispersalEdgeSoftness: number;
  dispersalScroll: { x: number; y: number };
  dispersalTextureName: string;
  sizeOverLifetimeEnabled: boolean;
  sizeOverLifetime: { x: number; y: number };
  sizeOverLifetimeBezier: [number, number, number, number];
  colorOverLifetimeEnabled: boolean;
  lifetimeGradient: ReturnType<typeof defaultGradientStops>;
  limitVelocityEnabled: boolean;
  limitVelocitySpeed: { x: number; y: number };
  limitVelocityDampen: number;
  colorBySpeedEnabled: boolean;
  colorBySpeedRange: { x: number; y: number };
  colorBySpeedGradient: ReturnType<typeof defaultGradientStops>;
  sizeBySpeedEnabled: boolean;
  sizeBySpeedRange: { x: number; y: number };
  sizeBySpeedMultiplier: { x: number; y: number };
  rotationBySpeedEnabled: boolean;
  rotationBySpeedRange: { x: number; y: number };
  rotationBySpeedAngular: { x: number; y: number };
  exportJson: string;
  diagnostics: string;
};

export function createInitialEditorParams(): EditorParams {
  return {
    presetName: "customEffect",
    simulationSpace: "local",
    simulation: "auto",
    maxParticles: 256,
    duration: 1,
    loop: true,
    prewarm: false,
    emitterType: "cone",
    emitterBoxSize: { x: 1, y: 1, z: 1 },
    emitterRadius: 0.4,
    emitterEmitFrom: "volume",
    emitterAngle: 25,
    emitterLength: 1,
    emissionMode: "rate",
    burstCount: { x: 8, y: 16 },
    burstTime: 0,
    burstProbability: 1,
    rateOverTime: 5,
    lifetimeRange: { x: 0.8, y: 1.2 },
    speedRange: { x: 0.3, y: 1.5 },
    sizeRange: { x: 1, y: 1 },
    opacityRange: { x: 1, y: 1 },
    startRotationRange: { x: 0, y: 0 },
    startAngularVelocityRange: { x: 0, y: 0 },
    startColorMode: "single",
    startColorA: "#ffffff",
    startColorB: "#ffb36b",
    drag: 0,
    acceleration: { x: 0, y: 0, z: 0 },
    vortexEnabled: false,
    vortexCenter: { x: 0, y: 0, z: 0 },
    vortexAxis: { x: 0, y: 1, z: 0 },
    vortexOrbitalSpeed: 0,
    vortexInward: 0,
    vortexUpward: 0,
    noiseEnabled: true,
    noiseStrength: 0,
    noiseFrequency: 1,
    noiseScroll: { x: 0, y: 0, z: 0 },
    noiseOctaves: 1,
    noiseLacunarity: 2,
    noisePersistence: 0.5,
    velocityOverLifetimeEnabled: false,
    velocityLinearX: { x: 0, y: 0 },
    velocityLinearY: { x: 0, y: 0 },
    velocityLinearZ: { x: 0, y: 0 },
    rendererType: "billboard",
    rendererBlendMode: "alpha",
    rendererAlign: "camera",
    rendererSorting: "distance",
    rendererTexture: "hardDisc",
    rendererStretchFactor: 0.35,
    rendererStretchMaxScale: 4,
    rendererDepthWrite: false,
    rendererDepthTest: true,
    rendererSoftParticles: false,
    rendererSoftness: 1.5,
    rendererAlphaFromLuminanceEnabled: false,
    rendererAlphaFromLuminanceBlackCutoff: 32,
    rendererTextureSheetEnabled: false,
    rendererTextureSheetTextureName: "Built-in",
    rendererTextureSheetColumns: 2,
    rendererTextureSheetRows: 2,
    rendererTextureSheetAnimationMode: "overLifetime",
    dispersalEnabled: false,
    dispersalStrength: 1,
    dispersalAmount: { x: 0, y: 1 },
    dispersalStartAt: 0,
    dispersalNoiseScale: 6,
    dispersalEdgeSoftness: 0.12,
    dispersalScroll: { x: 0, y: 0 },
    dispersalTextureName: "Built-in noise",
    sizeOverLifetimeEnabled: false,
    sizeOverLifetime: { x: 1, y: 0 },
    sizeOverLifetimeBezier: [0.33, 0, 0.66, 1],
    colorOverLifetimeEnabled: false,
    lifetimeGradient: defaultGradientStops(),
    limitVelocityEnabled: false,
    limitVelocitySpeed: { x: 5, y: 5 },
    limitVelocityDampen: 1,
    colorBySpeedEnabled: false,
    colorBySpeedRange: { x: 0, y: 10 },
    colorBySpeedGradient: defaultGradientStops(),
    sizeBySpeedEnabled: false,
    sizeBySpeedRange: { x: 0, y: 10 },
    sizeBySpeedMultiplier: { x: 1, y: 1 },
    rotationBySpeedEnabled: false,
    rotationBySpeedRange: { x: 0, y: 10 },
    rotationBySpeedAngular: { x: 0, y: 0 },
    exportJson: "",
    diagnostics: "No validation issues.",
  };
}
