import * as THREE from "three";
import { Pane } from "tweakpane";
import { ParticleWorld } from "../src";
import type { Curve, ParticlePreset, ParticleSystem } from "../src";
import {
  defaultGradientStops,
  normalizeGradientStops,
  tweakpaneGradientPluginBundle,
  type GradientStopsValue,
} from "./tweakpane-gradient-plugin/index.js";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#222222");

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4.2, 8);
camera.lookAt(0, 1, 0);

const orbitTarget = new THREE.Vector3(0, 0.9, 0);
const orbitOffset = camera.position.clone().sub(orbitTarget);
const orbit = new THREE.Spherical().setFromVector3(orbitOffset);
const targetOrbit = orbit.clone();
const orbitCameraOffset = new THREE.Vector3();
const minOrbitPhi = 0.08;
const maxOrbitPhi = Math.PI - 0.08;
const minOrbitRadius = 3.2;
const maxOrbitRadius = 14;

function updateCameraOrbit(immediate = false) {
  if (immediate) {
    orbit.radius = targetOrbit.radius;
    orbit.phi = targetOrbit.phi;
    orbit.theta = targetOrbit.theta;
  } else {
    orbit.radius = THREE.MathUtils.lerp(orbit.radius, targetOrbit.radius, 0.16);
    orbit.phi = THREE.MathUtils.lerp(orbit.phi, targetOrbit.phi, 0.16);
    orbit.theta = THREE.MathUtils.lerp(orbit.theta, targetOrbit.theta, 0.16);
  }

  camera.position.copy(orbitTarget).add(orbitCameraOffset.setFromSpherical(orbit));
  camera.lookAt(orbitTarget);
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight("#ffffff", 2.5);
light.position.set(4, 8, 5);
scene.add(light);
scene.add(new THREE.AmbientLight("#7788aa", 1.5));

const floorMaterial = new THREE.MeshStandardMaterial({
  color: "#545454",
  roughness: 0.85,
  metalness: 0,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(16, 16, "#949494", "#949494");
scene.add(grid);

const primitiveCollisionDebugMaterial = new THREE.MeshBasicMaterial({
  color: "#808080",
  wireframe: false,
  transparent: false,
  opacity: 1,
  depthTest: true,
  depthWrite: true,
});

function makeSoftDiscTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeHardDiscTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSparkTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(size / 2, size / 2);
  const gradient = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(-size / 2, -3, size, 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const softDisc = makeSoftDiscTexture();
const hardDisc = makeHardDiscTexture();
const spark = makeSparkTexture();
let customImageTexture: THREE.Texture | undefined;
let customImageSource: HTMLImageElement | undefined;
let demoSpriteSheetTexture: THREE.Texture | undefined;
let demoSpriteSheetColumns = 0;
let demoSpriteSheetRows = 0;

type DemoEffectName =
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
  | "shockwave"
  | "gpuMagicStorm"
  | "customEffect"
  | "explosionCombo";
type TextureName = "softDisc" | "hardDisc" | "spark" | "demoSpriteSheet" | "customImage";
type EmitterType = "point" | "sphere" | "hemisphere" | "cone" | "box";

const customParams = {
  clickEffect: "customEffect" as DemoEffectName,
  simulation: "cpu" as ParticlePreset["simulation"],
  maxParticles: 512,
  duration: 1.25,
  loop: false,
  prewarm: false,
  gpuMaxSpawnPerFrame: 512,
  debugGizmos: false,
  debugAllGizmos: false,
  debugSpawnDirection: true,
  gizmoColor: "#78d7ff",
  emissionEnabled: true,
  shapeEnabled: true,
  velocityEnabled: true,
  velocityOverLifetimeEnabled: true,
  forceEnabled: true,
  colorOverLifetimeEnabled: true,
  sizeOverLifetimeEnabled: true,
  rotationOverLifetimeEnabled: true,
  rendererEnabled: true,
  texture: "softDisc" as TextureName,
  imageAlphaFromLuminance: true,
  textureSheetEnabled: false,
  textureSheetColumns: 4,
  textureSheetRows: 4,
  textureSheetRandomFrame: true,
  textureSheetFrameOverLifetime: false,
  blendMode: "additive" as NonNullable<ParticlePreset["renderer"]>["blendMode"],
  align: "camera" as NonNullable<ParticlePreset["renderer"]>["align"],
  sorting: "distance" as NonNullable<ParticlePreset["renderer"]>["sorting"],
  emitter: "sphere" as EmitterType,
  emitFrom: "volume" as "volume" | "shell",
  radius: 0.45,
  coneAngle: 28,
  coneLength: 1.5,
  boxX: 3,
  boxY: 1.2,
  boxZ: 3,
  emission: "burst" as "burst" | "rate",
  rate: 140,
  burstMin: 90,
  burstMax: 140,
  lifetimeMin: 0.6,
  lifetimeMax: 1.8,
  speedMin: 0.4,
  speedMax: 2.6,
  sizeMin: 0.05,
  sizeMax: 0.22,
  opacityMin: 0.35,
  opacityMax: 0.95,
  startRotationMin: 0,
  startRotationMax: 360,
  angularVelocityMin: -1.5,
  angularVelocityMax: 1.5,
  startColorA: "#ffffff",
  startColorB: "#ffffff",
  lifetimeGradient: defaultGradientStops(),
  velocityX: 0.15,
  velocityYMin: 0,
  velocityYMax: 0.9,
  velocityZ: 0.15,
  lifetimeVelocityXStart: 0,
  lifetimeVelocityXEnd: 0,
  lifetimeVelocityYStart: 0.75,
  lifetimeVelocityYEnd: -0.35,
  lifetimeVelocityZStart: 0,
  lifetimeVelocityZEnd: 0,
  accelerationX: 0,
  accelerationY: -0.25,
  accelerationZ: 0,
  drag: 0.45,
  noiseStrength: 0.28,
  noiseFrequency: 4.5,
  grow: 1.25,
};

function makeCustomEmitter(): ParticlePreset["emitter"] {
  if (customParams.emitter === "point") return { type: "point" };
  if (customParams.emitter === "cone") return { type: "cone", radius: customParams.radius, angle: customParams.coneAngle, length: customParams.coneLength };
  if (customParams.emitter === "box") return { type: "box", size: [customParams.boxX, customParams.boxY, customParams.boxZ] };
  return { type: customParams.emitter, radius: customParams.radius, emitFrom: customParams.emitFrom };
}

function makeDebugOptions(): NonNullable<ParticlePreset["debug"]> {
  return {
    enabled: true,
    emitter: true,
    spawnDirection: customParams.debugSpawnDirection,
    color: customParams.gizmoColor,
  };
}

function getSelectedTexture(): THREE.Texture {
  if (customParams.texture === "hardDisc") return hardDisc;
  if (customParams.texture === "spark") return spark;
  if (customParams.texture === "demoSpriteSheet") return getDemoSpriteSheetTexture();
  if (customParams.texture === "customImage" && customImageTexture) return customImageTexture;
  return softDisc;
}

function makeTextureFromImage(image: HTMLImageElement, alphaFromLuminance: boolean): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create custom particle texture canvas context.");

  ctx.drawImage(image, 0, 0);

  if (alphaFromLuminance) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      data[i + 3] = Math.round((data[i + 3] * luminance) / 255);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function getTextureSheetColumns(): number {
  return Math.max(1, Math.floor(customParams.textureSheetColumns));
}

function getTextureSheetRows(): number {
  return Math.max(1, Math.floor(customParams.textureSheetRows));
}

function makeDemoSpriteSheetTexture(columns: number, rows: number): THREE.Texture {
  const tileSize = 96;
  const canvas = document.createElement("canvas");
  canvas.width = columns * tileSize;
  canvas.height = rows * tileSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create demo spritesheet canvas context.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 34px system-ui, sans-serif";

  const total = columns * rows;
  for (let i = 0; i < total; i++) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const x = column * tileSize;
    const y = row * tileSize;
    const hue = (i / Math.max(1, total)) * 330;

    const gradient = ctx.createRadialGradient(x + tileSize * 0.5, y + tileSize * 0.5, 4, x + tileSize * 0.5, y + tileSize * 0.5, tileSize * 0.48);
    gradient.addColorStop(0, `hsla(${hue}, 100%, 78%, 1)`);
    gradient.addColorStop(0.48, `hsla(${hue + 22}, 92%, 58%, 0.95)`);
    gradient.addColorStop(1, `hsla(${hue + 44}, 100%, 42%, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, tileSize, tileSize);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(String(i + 1), x + tileSize * 0.5, y + tileSize * 0.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function getDemoSpriteSheetTexture(): THREE.Texture {
  const columns = getTextureSheetColumns();
  const rows = getTextureSheetRows();
  if (!demoSpriteSheetTexture || demoSpriteSheetColumns !== columns || demoSpriteSheetRows !== rows) {
    demoSpriteSheetTexture?.dispose();
    demoSpriteSheetTexture = makeDemoSpriteSheetTexture(columns, rows);
    demoSpriteSheetColumns = columns;
    demoSpriteSheetRows = rows;
  }
  return demoSpriteSheetTexture;
}

function rebuildCustomImageTexture(): void {
  if (!customImageSource) return;
  customImageTexture = makeTextureFromImage(customImageSource, customParams.imageAlphaFromLuminance);
}

function degreesRange(minDegrees: number, maxDegrees: number): number | [number, number] {
  const min = Math.min(minDegrees, maxDegrees);
  const max = Math.max(minDegrees, maxDegrees);
  const minRadians = THREE.MathUtils.degToRad(min);
  const maxRadians = THREE.MathUtils.degToRad(max);
  return minRadians === maxRadians ? minRadians : [minRadians, maxRadians];
}

function makeCustomPreset(): ParticlePreset {
  const burstMin = Math.min(customParams.burstMin, customParams.burstMax);
  const burstMax = Math.max(customParams.burstMin, customParams.burstMax);
  const lifetimeMin = Math.min(customParams.lifetimeMin, customParams.lifetimeMax);
  const lifetimeMax = Math.max(customParams.lifetimeMin, customParams.lifetimeMax);
  const speedMin = Math.min(customParams.speedMin, customParams.speedMax);
  const speedMax = Math.max(customParams.speedMin, customParams.speedMax);
  const sizeMin = Math.min(customParams.sizeMin, customParams.sizeMax);
  const sizeMax = Math.max(customParams.sizeMin, customParams.sizeMax);
  const opacityMin = Math.min(customParams.opacityMin, customParams.opacityMax);
  const opacityMax = Math.max(customParams.opacityMin, customParams.opacityMax);
  const angularVelocityMin = Math.min(customParams.angularVelocityMin, customParams.angularVelocityMax);
  const angularVelocityMax = Math.max(customParams.angularVelocityMin, customParams.angularVelocityMax);

  return {
    simulation: customParams.simulation,
    maxParticles: customParams.maxParticles,
    duration: customParams.duration,
    loop: customParams.loop,
    prewarm: customParams.prewarm,
    autoDispose: !customParams.loop,
    debug: customParams.debugGizmos ? makeDebugOptions() : false,
    gpu: { maxSpawnPerFrame: customParams.gpuMaxSpawnPerFrame },
    emitter: customParams.shapeEnabled ? makeCustomEmitter() : undefined,
    emission: customParams.emissionEnabled
      ? customParams.emission === "rate"
        ? { rateOverTime: customParams.rate }
        : { bursts: [{ time: 0, count: [burstMin, burstMax] }] }
      : undefined,
    start: {
      lifetime: [lifetimeMin, lifetimeMax],
      speed: [speedMin, speedMax],
      size: [sizeMin, sizeMax],
      color: customParams.colorOverLifetimeEnabled ? "#ffffff" : [customParams.startColorA, customParams.startColorB],
      opacity: [opacityMin, opacityMax],
      velocity: customParams.velocityEnabled
        ? [[-customParams.velocityX, customParams.velocityYMin, -customParams.velocityZ], [customParams.velocityX, customParams.velocityYMax, customParams.velocityZ]]
        : undefined,
      rotation: degreesRange(customParams.startRotationMin, customParams.startRotationMax),
      angularVelocity: customParams.rotationOverLifetimeEnabled ? [angularVelocityMin, angularVelocityMax] : 0,
    },
    forces: customParams.forceEnabled
      ? {
          acceleration: [customParams.accelerationX, customParams.accelerationY, customParams.accelerationZ],
          drag: customParams.drag,
          noise: { strength: customParams.noiseStrength, frequency: customParams.noiseFrequency },
        }
      : undefined,
    velocityOverLifetime: customParams.velocityOverLifetimeEnabled
      ? {
          linear: {
            x: [[0, customParams.lifetimeVelocityXStart], [1, customParams.lifetimeVelocityXEnd]],
            y: [[0, customParams.lifetimeVelocityYStart], [1, customParams.lifetimeVelocityYEnd]],
            z: [[0, customParams.lifetimeVelocityZStart], [1, customParams.lifetimeVelocityZEnd]],
          },
        }
      : undefined,
    overLifetime: {
      size: customParams.sizeOverLifetimeEnabled ? [[0, 0], [0.18, 1], [1, customParams.grow]] : undefined,
      opacity: customParams.lifetimeGradient.opacities.map(([t, a]) => [t, a] as [number, number]),
      color: customParams.colorOverLifetimeEnabled
        ? customParams.lifetimeGradient.colors.map(([t, c]) => [t, c] as [number, string])
        : undefined,
    },
    renderer: customParams.rendererEnabled
      ? {
          texture: getSelectedTexture(),
          blendMode: customParams.blendMode,
          align: customParams.align,
          sorting: customParams.sorting,
          depthWrite: false,
          textureSheet: customParams.textureSheetEnabled
            ? {
                columns: getTextureSheetColumns(),
                rows: getTextureSheetRows(),
                randomFrame: customParams.textureSheetRandomFrame,
                frameOverLifetime: customParams.textureSheetFrameOverLifetime,
              }
            : undefined,
        }
      : undefined,
  };
}

function textureExportName(): string {
  if (customParams.texture === "hardDisc") return "hardDisc";
  if (customParams.texture === "spark") return "spark";
  if (customParams.texture === "demoSpriteSheet") return "demoSpriteSheetTexture";
  if (customParams.texture === "customImage") return "customBillboardTexture";
  return "softDisc";
}

function makeExportablePreset(): ParticlePreset {
  const preset = makeCustomPreset();
  if (preset.renderer) {
    preset.renderer = {
      ...preset.renderer,
      texture: "__PARTICLE_TEXTURE__" as unknown as THREE.Texture,
    };
  }
  return preset;
}

function makePresetCode(): string {
  const textureName = textureExportName();
  const presetCode = JSON.stringify(makeExportablePreset(), null, 2).replace(/"__PARTICLE_TEXTURE__"/g, textureName);
  const textureHint =
    customParams.texture === "customImage"
      ? "// const customBillboardTexture = new THREE.TextureLoader().load(\"/particles/your-image.png\");\n// customBillboardTexture.colorSpace = THREE.SRGBColorSpace;\n\n"
      : customParams.texture === "demoSpriteSheet"
        ? "// const demoSpriteSheetTexture = new THREE.TextureLoader().load(\"/particles/your-spritesheet.png\");\n// demoSpriteSheetTexture.colorSpace = THREE.SRGBColorSpace;\n\n"
      : "";

  return `${textureHint}const customEffect: ParticlePreset = ${presetCode};`;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function showCopyStatus(message: string): void {
  copyStatus.textContent = message;
  window.setTimeout(() => {
    if (copyStatus.textContent === message) copyStatus.textContent = "";
  }, 2200);
}

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
  renderer: { texture: softDisc, blendMode: "alpha", depthWrite: false },
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

/** Looping CPU demo: gravity, soft noise, and an infinite ground plane at local `y = 0` (matches the demo floor when spawned on the ground). */
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

const sphereCollisionCenter: [number, number, number] = [0, 1.2, 0];
const sphereCollisionRadius = 0.72;

/** Looping CPU demo: particles bounce out of a local-space sphere collider. */
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
  forces: { acceleration: [0, -3.5, 0], drag: 0.1, },
  overLifetime: {
    size: [[0, 0.45], [0.25, 1], [1, 0.82]],
    opacity: [[0, 0], [0.08, 1], [0.88, 0.95], [1, 0]],
    color: [[0, "#ffffff"], [0.42, "#b9e7ff"], [1, "#66b9ff"]],
  },
  renderer: { texture: softDisc, blendMode: "additive", depthWrite: false },
};

const boxCollisionCenter: [number, number, number] = [1.2, 0.45, 0];
const boxCollisionSize: [number, number, number] = [1.4, 1.2, 1.4];

/** Looping CPU demo: particles collide against a local-space axis-aligned box volume. */
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
    // Bias strongly along +X so particles shoot sideways into the box's -X face.
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
        count: [20, 30],
      },
    ],
  },
  start: {
    lifetime: [1, 1.76],
    speed: [14.13, 16.3],
    size: [1.265, 1.98],
    color: "#ffffff",
    opacity: [1, 1],
    velocity: [[-0.15, 0, -0.15], [0.15, 0, 0.15]],
    rotation: [0, Math.PI * 2],
    angularVelocity: [-1.3, 1.3],
  },
  forces: {
    acceleration: [0, 2.95, 0],
    drag: 6.52,
    noise: {
      strength: 0.28,
      frequency: 4.5,
    },
  },
  overLifetime: {
    size: [[0, 0], [0.12, 1],  [1, 0]],
    "opacity": [
      [
        0,
        1
      ],
      [
        0.74515625,
        0.6211032653942217
      ],
      [
        1,
        0
      ]
    ],
    "color": [
      [
        0,
        "#ffffff"
      ],
      [
        0.11036458333333334,
        "#fff59d"
      ],
      [
        0.2570572916666667,
        "#f4b53f"
      ],
      [
        0.4859895833333333,
        "#b47a2e"
      ],
      [
        0.6268489583333333,
        "#994d34"
      ],
      [
        0.828984375,
        "#303030"
      ]
    ]
  },
  renderer: {
    texture: softDisc,
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
    rotation: [0,0],
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

const particleWorldOptions = {
  renderer,
  ...(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pool") === "1"
    ? { pooling: true as const }
    : {}),
};

const particles = new ParticleWorld(
  scene,
  {
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
    shockwave,
    gpuMagicStorm,
    customEffect: makeCustomPreset(),
  },
  particleWorldOptions
);
// particles.spawn("magicAura", { position: [-2.2, 0.2, 0] });
// particles.spawn("gpuMagicStorm", { position: [1.2, 0.3, 0] });

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
  shockwave,
  gpuMagicStorm,
};

const sphereCollisionHelper = new THREE.Mesh(new THREE.SphereGeometry(sphereCollisionRadius, 24, 16), primitiveCollisionDebugMaterial);
sphereCollisionHelper.position.set(...sphereCollisionCenter);
sphereCollisionHelper.visible = false;
sphereCollisionHelper.renderOrder = -10;
scene.add(sphereCollisionHelper);

const boxCollisionHelper = new THREE.Mesh(new THREE.BoxGeometry(...boxCollisionSize), primitiveCollisionDebugMaterial);
boxCollisionHelper.position.set(...boxCollisionCenter);
boxCollisionHelper.visible = false;
boxCollisionHelper.renderOrder = -10;
scene.add(boxCollisionHelper);

function updatePrimitiveCollisionHelpers(): void {
  const showSphere = customParams.clickEffect === "sphereCollisionDemo";
  const showBox = customParams.clickEffect === "boxCollisionDemo";
  sphereCollisionHelper.visible = showSphere;
  boxCollisionHelper.visible = showBox;
}

const paneContainer = document.createElement("div");
paneContainer.className = "tweakpane-wrap";
document.body.appendChild(paneContainer);

const scenePaneParams = {
  groundVisible: true,
  groundColor: `#${floorMaterial.color.getHexString()}`,
};

const pane = new Pane({ title: "Particle effect", container: paneContainer });
pane.registerPlugin(tweakpaneGradientPluginBundle);
const mainTabs = pane.addTab({
  pages: [{ title: "Particles" }, { title: "Scene" }],
});
const particlesPane = mainTabs.pages[0] as PaneLike;
const scenePane = mainTabs.pages[1];

scenePane
  .addBinding(scenePaneParams, "groundVisible", { label: "Ground plane" })
  .on("change", (ev) => {
    floor.visible = ev.value;
    grid.visible = ev.value;
  });
scenePane
  .addBinding(scenePaneParams, "groundColor", { label: "Ground color", view: "color" })
  .on("change", (ev) => {
    floorMaterial.color.set(ev.value);
  });
let loopPreview: ParticleSystem | undefined;

function refreshCustomPreset() {
  particles.register("customEffect", makeCustomPreset());
  updatePrimitiveCollisionHelpers();
  if (customParams.debugAllGizmos) particles.setDebug(makeDebugOptions());
  if (loopPreview) {
    loopPreview.dispose();
    particles.systems.delete(loopPreview);
    loopPreview = undefined;
  }
  if (customParams.loop && customParams.clickEffect === "customEffect") previewCustomLoop();
}

function previewCustomLoop() {
  if (loopPreview) {
    loopPreview.dispose();
    particles.systems.delete(loopPreview);
  }
  loopPreview = particles.spawn("customEffect", { position: [0, 0.2, 0] });
}

function spawnEffect(name: DemoEffectName, position: THREE.Vector3 | [number, number, number]) {
  if (name === "explosionCombo") {
    particles.spawn("explosion", { position });
    const smokePosition = Array.isArray(position) ? new THREE.Vector3(...position) : position.clone();
    particles.spawn("smokePuff", { position: smokePosition.add(new THREE.Vector3(0, 0.15, 0)) });
    return;
  }

  const spawnPosition = Array.isArray(position) ? new THREE.Vector3(...position) : position.clone();
  if (name === "rainGpu" || name === "snowGpu") spawnPosition.y = 6.5;

  const system = particles.spawn(name, { position: spawnPosition });
  if (name === "gpuMagicStorm") system.emit(1500);
}

function rangeValues(range: number | [number, number] | undefined, fallback: number): [number, number] {
  if (Array.isArray(range)) return [range[0], range[1]];
  const value = range ?? fallback;
  return [value, value];
}

function curveEndpoint(curve: Curve | undefined, end: "first" | "last"): number {
  if (!Array.isArray(curve) || curve.length === 0) return 0;
  return curve[end === "first" ? 0 : curve.length - 1][1];
}

function colorHex(color: THREE.ColorRepresentation): string {
  return `#${new THREE.Color(color).getHexString()}`;
}

function colorsFromPresetColor(color: NonNullable<ParticlePreset["start"]>["color"] | undefined): [string, string] {
  if (Array.isArray(color)) return [colorHex(color[0]), colorHex(color[1])];
  const value = colorHex(color ?? "#ffffff");
  return [value, value];
}

function lifetimeGradientFromOverLifetime(
  overLifetime: NonNullable<ParticlePreset["overLifetime"]> | undefined
): GradientStopsValue {
  const colors = overLifetime?.color?.map(([t, c]) => [t, colorHex(c)] as [number, string]);
  const opacities = overLifetime?.opacity?.map(([t, o]) => [t, o] as [number, number]);
  return normalizeGradientStops({
    colors: colors && colors.length >= 2 ? colors : defaultGradientStops().colors,
    opacities: opacities && opacities.length >= 2 ? opacities : defaultGradientStops().opacities,
  });
}

function textureNameForTexture(texture: THREE.Texture | undefined): TextureName {
  if (texture === hardDisc) return "hardDisc";
  if (texture === spark) return "spark";
  if (texture === demoSpriteSheetTexture) return "demoSpriteSheet";
  return "softDisc";
}

function loadPresetIntoEditor(name: DemoEffectName): void {
  const preset = editablePresets[name];
  if (!preset) return;

  customParams.clickEffect = "customEffect";
  customParams.simulation = preset.simulation ?? "cpu";
  customParams.maxParticles = preset.maxParticles ?? 256;
  customParams.duration = preset.duration ?? 1;
  customParams.loop = preset.loop ?? false;
  customParams.prewarm = preset.prewarm ?? false;
  customParams.gpuMaxSpawnPerFrame = preset.gpu?.maxSpawnPerFrame ?? 512;
  customParams.debugGizmos = !!preset.debug;

  const emission = preset.emission;
  customParams.emissionEnabled = !!emission;
  customParams.emission = emission?.rateOverTime !== undefined ? "rate" : "burst";
  const [rateMin, rateMax] = rangeValues(emission?.rateOverTime, customParams.rate);
  customParams.rate = rateMax;
  const firstBurst = emission?.bursts?.[0];
  const [burstMin, burstMax] = rangeValues(firstBurst?.count, 0);
  customParams.burstMin = burstMin;
  customParams.burstMax = burstMax;

  const emitter = preset.emitter;
  customParams.shapeEnabled = !!emitter;
  customParams.emitter = emitter?.type ?? "point";
  customParams.emitFrom = "emitFrom" in (emitter ?? {}) ? (emitter as Extract<ParticlePreset["emitter"], { emitFrom?: "volume" | "shell" }>).emitFrom ?? "volume" : "volume";
  customParams.radius = "radius" in (emitter ?? {}) ? (emitter as Extract<ParticlePreset["emitter"], { radius?: number }>).radius ?? 1 : 0;
  customParams.coneAngle = emitter?.type === "cone" ? emitter.angle ?? 25 : customParams.coneAngle;
  customParams.coneLength = emitter?.type === "cone" ? emitter.length ?? 1 : customParams.coneLength;
  const boxSize = emitter?.type === "box" ? emitter.size ?? [1, 1, 1] : [customParams.boxX, customParams.boxY, customParams.boxZ];
  customParams.boxX = boxSize[0];
  customParams.boxY = boxSize[1];
  customParams.boxZ = boxSize[2];

  const start = preset.start ?? {};
  [customParams.lifetimeMin, customParams.lifetimeMax] = rangeValues(start.lifetime, 1);
  [customParams.speedMin, customParams.speedMax] = rangeValues(start.speed, 1);
  [customParams.sizeMin, customParams.sizeMax] = rangeValues(start.size, 0.2);
  [customParams.opacityMin, customParams.opacityMax] = rangeValues(start.opacity, 1);
  [customParams.startColorA, customParams.startColorB] = colorsFromPresetColor(start.color);
  const [rotationMin, rotationMax] = rangeValues(start.rotation, 0);
  customParams.startRotationMin = THREE.MathUtils.radToDeg(rotationMin);
  customParams.startRotationMax = THREE.MathUtils.radToDeg(rotationMax);
  const [angularMin, angularMax] = rangeValues(start.angularVelocity, 0);
  customParams.angularVelocityMin = angularMin;
  customParams.angularVelocityMax = angularMax;
  customParams.rotationOverLifetimeEnabled = angularMin !== 0 || angularMax !== 0;

  if (Array.isArray(start.velocity?.[0])) {
    const [minVelocity, maxVelocity] = start.velocity as [[number, number, number], [number, number, number]];
    customParams.velocityEnabled = true;
    customParams.velocityX = Math.max(Math.abs(minVelocity[0]), Math.abs(maxVelocity[0]));
    customParams.velocityYMin = minVelocity[1];
    customParams.velocityYMax = maxVelocity[1];
    customParams.velocityZ = Math.max(Math.abs(minVelocity[2]), Math.abs(maxVelocity[2]));
  } else {
    customParams.velocityEnabled = !!start.velocity;
    customParams.velocityX = 0;
    customParams.velocityYMin = Array.isArray(start.velocity) ? start.velocity[1] : 0;
    customParams.velocityYMax = customParams.velocityYMin;
    customParams.velocityZ = 0;
  }

  const forces = preset.forces;
  customParams.forceEnabled = !!forces;
  const acc = forces?.acceleration ?? [0, 0, 0];
  customParams.accelerationX = acc[0] ?? 0;
  customParams.accelerationY = acc[1] ?? 0;
  customParams.accelerationZ = acc[2] ?? 0;
  customParams.drag = forces?.drag ?? 0;
  customParams.noiseStrength = forces?.noise?.strength ?? 0;
  customParams.noiseFrequency = forces?.noise?.frequency ?? 1;

  const velocityOverLifetime = preset.velocityOverLifetime;
  customParams.velocityOverLifetimeEnabled = !!velocityOverLifetime;
  customParams.lifetimeVelocityXStart = curveEndpoint(velocityOverLifetime?.linear?.x, "first");
  customParams.lifetimeVelocityXEnd = curveEndpoint(velocityOverLifetime?.linear?.x, "last");
  customParams.lifetimeVelocityYStart = curveEndpoint(velocityOverLifetime?.linear?.y, "first");
  customParams.lifetimeVelocityYEnd = curveEndpoint(velocityOverLifetime?.linear?.y, "last");
  customParams.lifetimeVelocityZStart = curveEndpoint(velocityOverLifetime?.linear?.z, "first");
  customParams.lifetimeVelocityZEnd = curveEndpoint(velocityOverLifetime?.linear?.z, "last");

  const overLifetime = preset.overLifetime ?? {};
  customParams.sizeOverLifetimeEnabled = !!overLifetime.size;
  customParams.grow = overLifetime.size?.[overLifetime.size.length - 1]?.[1] ?? 1;
  customParams.colorOverLifetimeEnabled = !!overLifetime.color;
  customParams.lifetimeGradient = lifetimeGradientFromOverLifetime(overLifetime);

  const renderer = preset.renderer;
  customParams.rendererEnabled = !!renderer;
  customParams.texture = textureNameForTexture(renderer?.texture);
  customParams.blendMode = renderer?.blendMode ?? "alpha";
  customParams.align = renderer?.align ?? "camera";
  customParams.sorting = renderer?.sorting ?? "distance";
  customParams.textureSheetEnabled = !!renderer?.textureSheet;
  customParams.textureSheetColumns = renderer?.textureSheet?.columns ?? 1;
  customParams.textureSheetRows = renderer?.textureSheet?.rows ?? 1;
  customParams.textureSheetRandomFrame = renderer?.textureSheet?.randomFrame ?? renderer?.textureSheet?.randomStartFrame ?? false;
  customParams.textureSheetFrameOverLifetime = renderer?.textureSheet?.frameOverLifetime ?? false;

  refreshPaneBindings();
  refreshCustomPreset();
  showCopyStatus(`Loaded ${name} into Custom.`);
}

type PaneLike = {
  addBinding: (object: object, key: string, params?: Record<string, unknown>) => { on: (event: "change", handler: () => void) => void; refresh?: () => void };
  addButton: (params: { title: string }) => { on: (event: "click", handler: () => void) => void };
  addFolder: (params: { title: string; expanded?: boolean }) => PaneLike;
};

const paneBindings: Array<{ refresh?: () => void }> = [];

function bind(folder: PaneLike, key: keyof typeof customParams, params?: Record<string, unknown>) {
  const binding = folder.addBinding(customParams, key, params);
  paneBindings.push(binding);
  binding.on("change", refreshCustomPreset);
  return binding;
}

function refreshPaneBindings(): void {
  for (const binding of paneBindings) binding.refresh?.();
  updatePrimitiveCollisionHelpers();
}

const controlsFolder = particlesPane.addFolder({ title: "Controls", expanded: true }) as PaneLike;
bind(controlsFolder, "clickEffect", {
  label: "click",
  options: {
    Custom: "customEffect",
    "Explosion + smoke": "explosionCombo",
    "Muzzle flash": "muzzleFlash",
    "Bullet impact sparks": "bulletImpactSparks",
    "Pickup sparkle": "pickupSparkle",
    "Torch fire": "torchFire",
    "Stretched billboard demo": "stretchedBillboardDemo",
    "Floor bounce (CPU collision)": "floorBounceDemo",
    "Sphere collision (CPU primitive)": "sphereCollisionDemo",
    "Box collision (CPU primitive)": "boxCollisionDemo",
    "Sub-emitters (CPU onBirth)": "onBirthSubEmittersDemo",
    "Sub-emitters (CPU onDeath)": "onDeathSubEmittersDemo",
    "Sub-emitters (CPU onCollision)": "onCollisionSubEmittersDemo",
    Smoke: "smokePuff",
    Explosion: "explosion",
    Shockwave: "shockwave",
    "Magic aura": "magicAura",
    "Rain GPU": "rainGpu",
    "Snow GPU": "snowGpu",
    "Magic aura GPU": "magicAuraGpu",
    "GPU storm": "gpuMagicStorm",
  },
});
controlsFolder.addButton({ title: "Spawn at center" }).on("click", () => spawnEffect(customParams.clickEffect, [0, 0.05, 0]));
controlsFolder.addButton({ title: "Load selected into editor" }).on("click", () => loadPresetIntoEditor(customParams.clickEffect));
controlsFolder.addButton({ title: "Preview loop" }).on("click", previewCustomLoop);
controlsFolder.addButton({ title: "Clear systems" }).on("click", () => {
  particles.clear();
  loopPreview = undefined;
});
controlsFolder.addButton({ title: "Copy preset code" }).on("click", () => {
  copyText(makePresetCode())
    .then(() => showCopyStatus("Preset code copied."))
    .catch(() => showCopyStatus("Could not copy preset code."));
});
updatePrimitiveCollisionHelpers();

const mainFolder = particlesPane.addFolder({ title: "Particle System", expanded: false }) as PaneLike;
bind(mainFolder, "simulation", { options: { CPU: "cpu", GPU: "gpu", Auto: "auto" } });
bind(mainFolder, "maxParticles", { label: "max particles", min: 16, max: 16000, step: 16 });
bind(mainFolder, "duration", { min: 0.05, max: 10, step: 0.05 });
bind(mainFolder, "loop");
bind(mainFolder, "prewarm");
bind(mainFolder, "gpuMaxSpawnPerFrame", { label: "gpu spawn/frame", min: 16, max: 2048, step: 16 });
bind(mainFolder, "debugGizmos", { label: "debug gizmos" });
const debugAllBinding = mainFolder.addBinding(customParams, "debugAllGizmos", { label: "debug all" });
paneBindings.push(debugAllBinding);
debugAllBinding.on("change", () => particles.setDebug(customParams.debugAllGizmos ? makeDebugOptions() : false));
bind(mainFolder, "debugSpawnDirection", { label: "spawn direction" });
bind(mainFolder, "gizmoColor", { label: "gizmo color" });
bind(mainFolder, "lifetimeMin", { label: "start life min", min: 0.02, max: 10, step: 0.01 });
bind(mainFolder, "lifetimeMax", { label: "start life max", min: 0.02, max: 10, step: 0.01 });
bind(mainFolder, "speedMin", { label: "start speed min", min: 0, max: 20, step: 0.01 });
bind(mainFolder, "speedMax", { label: "start speed max", min: 0, max: 20, step: 0.01 });
bind(mainFolder, "sizeMin", { label: "start size min", min: 0.005, max: 2, step: 0.005 });
bind(mainFolder, "sizeMax", { label: "start size max", min: 0.005, max: 2, step: 0.005 });
bind(mainFolder, "opacityMin", { label: "start alpha min", min: 0, max: 1, step: 0.01 });
bind(mainFolder, "opacityMax", { label: "start alpha max", min: 0, max: 1, step: 0.01 });
bind(mainFolder, "startColorA", { label: "start color min" });
bind(mainFolder, "startColorB", { label: "start color max" });

const emissionFolder = particlesPane.addFolder({ title: "Emission", expanded: false }) as PaneLike;
bind(emissionFolder, "emissionEnabled", { label: "enabled" });
bind(emissionFolder, "emission", { options: { Burst: "burst", Rate: "rate" } });
bind(emissionFolder, "rate", { label: "rate over time", min: 0, max: 2000, step: 1 });
bind(emissionFolder, "burstMin", { label: "burst min", min: 0, max: 2000, step: 1 });
bind(emissionFolder, "burstMax", { label: "burst max", min: 0, max: 2000, step: 1 });

const shapeFolder = particlesPane.addFolder({ title: "Shape", expanded: false }) as PaneLike;
bind(shapeFolder, "shapeEnabled", { label: "enabled" });
bind(shapeFolder, "emitter", { label: "shape", options: { Point: "point", Sphere: "sphere", Hemisphere: "hemisphere", Cone: "cone", Box: "box" } });
bind(shapeFolder, "emitFrom", { label: "emit from", options: { Volume: "volume", Shell: "shell" } });
bind(shapeFolder, "radius", { min: 0, max: 6, step: 0.01 });
bind(shapeFolder, "coneAngle", { label: "angle", min: 0, max: 89, step: 1 });
bind(shapeFolder, "coneLength", { label: "length", min: 0.01, max: 8, step: 0.01 });
bind(shapeFolder, "boxX", { label: "box x", min: 0.1, max: 10, step: 0.1 });
bind(shapeFolder, "boxY", { label: "box y", min: 0.1, max: 10, step: 0.1 });
bind(shapeFolder, "boxZ", { label: "box z", min: 0.1, max: 10, step: 0.1 });

const velocityFolder = particlesPane.addFolder({ title: "Start Velocity", expanded: false }) as PaneLike;
bind(velocityFolder, "velocityEnabled", { label: "enabled" });
bind(velocityFolder, "velocityX", { label: "x spread", min: 0, max: 4, step: 0.01 });
bind(velocityFolder, "velocityYMin", { label: "y min", min: -5, max: 5, step: 0.01 });
bind(velocityFolder, "velocityYMax", { label: "y max", min: -5, max: 5, step: 0.01 });
bind(velocityFolder, "velocityZ", { label: "z spread", min: 0, max: 4, step: 0.01 });

const lifetimeVelocityFolder = particlesPane.addFolder({ title: "Velocity over Lifetime", expanded: false }) as PaneLike;
bind(lifetimeVelocityFolder, "velocityOverLifetimeEnabled", { label: "enabled" });
bind(lifetimeVelocityFolder, "lifetimeVelocityXStart", { label: "linear x start", min: -8, max: 8, step: 0.01 });
bind(lifetimeVelocityFolder, "lifetimeVelocityXEnd", { label: "linear x end", min: -8, max: 8, step: 0.01 });
bind(lifetimeVelocityFolder, "lifetimeVelocityYStart", { label: "linear y start", min: -8, max: 8, step: 0.01 });
bind(lifetimeVelocityFolder, "lifetimeVelocityYEnd", { label: "linear y end", min: -8, max: 8, step: 0.01 });
bind(lifetimeVelocityFolder, "lifetimeVelocityZStart", { label: "linear z start", min: -8, max: 8, step: 0.01 });
bind(lifetimeVelocityFolder, "lifetimeVelocityZEnd", { label: "linear z end", min: -8, max: 8, step: 0.01 });

const forceFolder = particlesPane.addFolder({ title: "Force over Lifetime", expanded: false }) as PaneLike;
bind(forceFolder, "forceEnabled", { label: "enabled" });
bind(forceFolder, "accelerationX", { label: "acceleration x", min: -10, max: 10, step: 0.01 });
bind(forceFolder, "accelerationY", { label: "acceleration y", min: -10, max: 10, step: 0.01 });
bind(forceFolder, "accelerationZ", { label: "acceleration z", min: -10, max: 10, step: 0.01 });
bind(forceFolder, "drag", { min: 0, max: 20, step: 0.01 });
bind(forceFolder, "noiseStrength", { label: "noise strength", min: 0, max: 5, step: 0.01 });
bind(forceFolder, "noiseFrequency", { label: "noise frequency", min: 0.1, max: 20, step: 0.1 });

const colorFolder = particlesPane.addFolder({ title: "Color / alpha over lifetime", expanded: false }) as PaneLike;
bind(colorFolder, "colorOverLifetimeEnabled", { label: "color gradient enabled" });
bind(colorFolder, "lifetimeGradient", { label: "gradient", view: "gradient" });

const sizeFolder = particlesPane.addFolder({ title: "Size over Lifetime", expanded: false }) as PaneLike;
bind(sizeFolder, "sizeOverLifetimeEnabled", { label: "enabled" });
bind(sizeFolder, "grow", { label: "end size", min: 0, max: 5, step: 0.01 });

const rotationFolder = particlesPane.addFolder({ title: "Rotation", expanded: false }) as PaneLike;
bind(rotationFolder, "startRotationMin", { label: "start min deg", min: -360, max: 360, step: 1 });
bind(rotationFolder, "startRotationMax", { label: "start max deg", min: -360, max: 360, step: 1 });
bind(rotationFolder, "rotationOverLifetimeEnabled", { label: "enabled" });
bind(rotationFolder, "angularVelocityMin", { label: "angular min rad/s", min: -20, max: 20, step: 0.01 });
bind(rotationFolder, "angularVelocityMax", { label: "angular max rad/s", min: -20, max: 20, step: 0.01 });

const rendererFolder = particlesPane.addFolder({ title: "Renderer", expanded: false }) as PaneLike;
bind(rendererFolder, "rendererEnabled", { label: "enabled" });
bind(rendererFolder, "texture", { options: { "Soft disc": "softDisc", "Hard disc": "hardDisc", Spark: "spark", "Demo spritesheet": "demoSpriteSheet", "Custom image": "customImage" } });
const imageAlphaBinding = bind(rendererFolder, "imageAlphaFromLuminance", { label: "image alpha" });
imageAlphaBinding.on("change", () => {
  rebuildCustomImageTexture();
  refreshCustomPreset();
});
bind(rendererFolder, "blendMode", { label: "blend", options: { Alpha: "alpha", Additive: "additive", Multiply: "multiply" } });
bind(rendererFolder, "align", { options: { Camera: "camera", Velocity: "velocity" } });
bind(rendererFolder, "sorting", {
  label: "sort",
  options: { None: "none", Distance: "distance", "Youngest in front": "youngestFirst", "Oldest in front": "oldestFirst" },
});

const sheetFolder = rendererFolder.addFolder({ title: "Texture Sheet", expanded: true }) as PaneLike;
bind(sheetFolder, "textureSheetEnabled", { label: "enabled" });
bind(sheetFolder, "textureSheetColumns", { label: "cols", min: 1, max: 12, step: 1 });
bind(sheetFolder, "textureSheetRows", { label: "rows", min: 1, max: 12, step: 1 });
bind(sheetFolder, "textureSheetRandomFrame", { label: "random frame" });
bind(sheetFolder, "textureSheetFrameOverLifetime", { label: "over lifetime" });

const customImageInput = document.createElement("input");
customImageInput.type = "file";
customImageInput.accept = "image/*";
customImageInput.hidden = true;
document.body.appendChild(customImageInput);

rendererFolder.addButton({ title: "Load billboard image" }).on("click", () => customImageInput.click());
customImageInput.addEventListener("change", () => {
  const file = customImageInput.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    customImageSource = image;
    rebuildCustomImageTexture();
    customParams.texture = "customImage";
    customParams.blendMode = "alpha";
    refreshCustomPreset();
    URL.revokeObjectURL(url);
    customImageInput.value = "";
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    customImageInput.value = "";
  };
  image.src = url;
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

function shouldIgnoreUiTarget(event: Event): boolean {
  return event.target instanceof Element && !!event.target.closest(".ui, .tweakpane-wrap, .tweakpane-wrap-scene");
}

function shouldIgnorePointer(event: PointerEvent): boolean {
  return shouldIgnoreUiTarget(event);
}

function spawnAtPointer(event: PointerEvent, kind: DemoEffectName = customParams.clickEffect) {
  if (shouldIgnorePointer(event)) return;

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(groundPlane, hit);

  spawnEffect(kind, hit.clone());
}

window.addEventListener("pointerdown", (event) => spawnAtPointer(event));
window.addEventListener(
  "wheel",
  (event) => {
    if (shouldIgnoreUiTarget(event)) return;
    event.preventDefault();

    const modeScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
    const deltaX = event.deltaX * modeScale;
    const deltaY = event.deltaY * modeScale;

    if (event.ctrlKey || event.metaKey) {
      targetOrbit.radius = THREE.MathUtils.clamp(targetOrbit.radius * (1 + deltaY * 0.0025), minOrbitRadius, maxOrbitRadius);
      return;
    }

    targetOrbit.theta -= deltaX * 0.006;
    targetOrbit.phi = THREE.MathUtils.clamp(targetOrbit.phi + deltaY * 0.004, minOrbitPhi, maxOrbitPhi);
  },
  { passive: false }
);
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === "1") spawnEffect("muzzleFlash", [-2, 1, 0]);
  if (event.key === "2") spawnEffect("bulletImpactSparks", [-1, 0.35, 0]);
  if (event.key === "3") spawnEffect("explosion", [2, 0, 0]);
  if (event.key === "4") spawnEffect("smokePuff", [0, 0, 0]);
  if (event.key === "5") spawnEffect("pickupSparkle", [0, 0.5, 0]);
  if (event.key === "6") spawnEffect("torchFire", [0, 0.1, 0]);
  if (event.key === "b" || event.key === "B") spawnEffect("floorBounceDemo", [0, 0.05, 0]);
  if (event.key === "7") spawnEffect("rainGpu", [0, 6.5, 0]);
  if (event.key === "8") spawnEffect("snowGpu", [0, 6.5, 0]);
  if (event.key === "9") spawnEffect("magicAuraGpu", [0, 0.2, 0]);
  if (event.key === "0") spawnEffect("shockwave", [0, 0.05, 0]);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  updateCameraOrbit();
  particles.update(dt, camera);
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
