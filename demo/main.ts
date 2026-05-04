import * as THREE from "three";
import { Pane } from "tweakpane";
import * as EssentialsPlugin from "@tweakpane/plugin-essentials";
import { ParticleWorld } from "../src";
import type { Curve, Gradient, ParticlePreset, ParticleSystem } from "../src";
import {
  defaultGradientStops,
  normalizeGradientStops,
  tweakpaneGradientPluginBundle,
  type GradientStopsValue,
} from "./tweakpane-gradient-plugin/index.js";
import {
  boxCollisionCenter,
  boxCollisionSize,
  createDemoPresets,
  type DemoEffectName,
  sphereCollisionCenter,
  sphereCollisionRadius,
} from "./presets";
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

function createSceneDepthTarget(): THREE.WebGLRenderTarget {
  const size = renderer.getSize(new THREE.Vector2());
  const pixelRatio = renderer.getPixelRatio();
  const width = Math.max(1, Math.floor(size.x * pixelRatio));
  const height = Math.max(1, Math.floor(size.y * pixelRatio));
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  return target;
}

let sceneDepthTarget = createSceneDepthTarget();

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
  limitVelocityEnabled: false,
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
  softParticles: false,
  softness: 1.5,
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
  limitSpeedStart: 6,
  limitSpeedEnd: 6,
  limitDampen: 1,
  noiseStrength: 0.28,
  noiseFrequency: 4.5,
  noiseScrollX: 0.2,
  noiseScrollY: 0.35,
  noiseScrollZ: 0.17,
  noiseOctaves: 2,
  noiseLacunarity: 2,
  noisePersistence: 0.5,
  vortexCenterX: 0,
  vortexCenterY: 0,
  vortexCenterZ: 0,
  vortexAxisX: 0,
  vortexAxisY: 1,
  vortexAxisZ: 0,
  vortexOrbitalSpeed: 0,
  vortexInward: 0,
  vortexUpward: 0,
  colorBySpeedEnabled: false,
  colorBySpeedMin: 0,
  colorBySpeedMax: 8,
  colorBySpeedGradient: defaultGradientStops(),
  sizeBySpeedEnabled: false,
  sizeBySpeedMin: 0,
  sizeBySpeedMax: 8,
  sizeBySpeedMulLow: 0.5,
  sizeBySpeedMulHigh: 1.5,
  rotationBySpeedEnabled: false,
  rotationBySpeedMin: 0,
  rotationBySpeedMax: 8,
  rotationBySpeedAvLow: 0.5,
  rotationBySpeedAvHigh: 6,
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
          vortex: {
            center: [customParams.vortexCenterX, customParams.vortexCenterY, customParams.vortexCenterZ],
            axis: [customParams.vortexAxisX, customParams.vortexAxisY, customParams.vortexAxisZ],
            orbitalSpeed: customParams.vortexOrbitalSpeed,
            inward: customParams.vortexInward,
            upward: customParams.vortexUpward,
          },
          noise: {
            strength: customParams.noiseStrength,
            frequency: customParams.noiseFrequency,
            scroll: [customParams.noiseScrollX, customParams.noiseScrollY, customParams.noiseScrollZ],
            octaves: Math.floor(customParams.noiseOctaves),
            lacunarity: customParams.noiseLacunarity,
            persistence: customParams.noisePersistence,
          },
        }
      : undefined,
    limitVelocityOverLifetime: customParams.limitVelocityEnabled
      ? {
          speed: [[0, customParams.limitSpeedStart], [1, customParams.limitSpeedEnd]],
          dampen: customParams.limitDampen,
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
    colorBySpeed: customParams.colorBySpeedEnabled
      ? {
          speedRange: [Math.min(customParams.colorBySpeedMin, customParams.colorBySpeedMax), Math.max(customParams.colorBySpeedMin, customParams.colorBySpeedMax)] as [number, number],
          gradient: customParams.colorBySpeedGradient.colors.map(([t, c]) => [t, c] as [number, string]),
        }
      : undefined,
    sizeBySpeed: customParams.sizeBySpeedEnabled
      ? {
          speedRange: [Math.min(customParams.sizeBySpeedMin, customParams.sizeBySpeedMax), Math.max(customParams.sizeBySpeedMin, customParams.sizeBySpeedMax)] as [number, number],
          curve: [
            [0, customParams.sizeBySpeedMulLow],
            [1, customParams.sizeBySpeedMulHigh],
          ],
        }
      : undefined,
    rotationBySpeed: customParams.rotationBySpeedEnabled
      ? {
          speedRange: [Math.min(customParams.rotationBySpeedMin, customParams.rotationBySpeedMax), Math.max(customParams.rotationBySpeedMin, customParams.rotationBySpeedMax)] as [number, number],
          angularVelocity: [
            [0, customParams.rotationBySpeedAvLow],
            [1, customParams.rotationBySpeedAvHigh],
          ],
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
          softParticles: customParams.softParticles,
          softness: customParams.softness,
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
const { worldPresets, editablePresets } = createDemoPresets({ softDisc, hardDisc, spark });

const particleWorldOptions = {
  renderer,
  ...(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pool") === "1"
    ? { pooling: true as const }
    : {}),
};

const particles = new ParticleWorld(
  scene,
  {
    ...worldPresets,
    customEffect: makeCustomPreset(),
  },
  particleWorldOptions
);
// particles.spawn("magicAura", { position: [-2.2, 0.2, 0] });
// particles.spawn("gpuMagicStorm", { position: [1.2, 0.3, 0] });

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
const capturePaneParams = {
  orbitCamera: false,
  orbitSpeedDegPerSecond: 18,
};
const runtimeStats = {
  systems: 0,
  cpuSystems: 0,
  gpuSystems: 0,
  aliveTotal: 0,
  maxTotal: 0,
  busiest: "none",
  busiestAlive: 0,
};
let runtimeStatsRefreshElapsed = 0;

const pane = new Pane({ title: "Particle effect", container: paneContainer });
pane.registerPlugin(EssentialsPlugin);
pane.registerPlugin(tweakpaneGradientPluginBundle);
const copyStatus = document.createElement("div");
copyStatus.className = "copy-status";
paneContainer.appendChild(copyStatus);
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

const capturePaneContainer = document.createElement("div");
capturePaneContainer.className = "tweakpane-wrap-capture";
document.body.appendChild(capturePaneContainer);
const capturePane = new Pane({ title: "Capture", container: capturePaneContainer });
capturePane.registerPlugin(EssentialsPlugin);
capturePane.addBinding(capturePaneParams, "orbitCamera", { label: "Auto orbit" });
capturePane.addBinding(capturePaneParams, "orbitSpeedDegPerSecond", {
  label: "Speed (deg/s)",
  min: -120,
  max: 120,
  step: 1,
});
const fpsGraph = (capturePane as unknown as { addBlade: (params: Record<string, unknown>) => { begin: () => void; end: () => void } }).addBlade({
  view: "fpsgraph",
  label: "FPS",
  rows: 2,
});
const runtimeFolder = capturePane.addFolder({ title: "Runtime stats", expanded: true });
runtimeFolder.addBinding(runtimeStats, "systems", { readonly: true });
runtimeFolder.addBinding(runtimeStats, "cpuSystems", { readonly: true, label: "cpu systems" });
runtimeFolder.addBinding(runtimeStats, "gpuSystems", { readonly: true, label: "gpu systems" });
runtimeFolder.addBinding(runtimeStats, "aliveTotal", { readonly: true, label: "alive total" });
runtimeFolder.addBinding(runtimeStats, "maxTotal", { readonly: true, label: "max total" });
runtimeFolder.addBinding(runtimeStats, "busiest", { readonly: true });
runtimeFolder.addBinding(runtimeStats, "busiestAlive", { readonly: true, label: "busiest alive" });
let loopPreview: ParticleSystem | undefined;
let orbitingEmitterDemo:
  | {
      system: ParticleSystem;
      center: THREE.Vector3;
      angle: number;
      radius: number;
      speed: number;
      height: number;
    }
  | undefined;

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
  if (name === "orbitingEmitterWorldDemo") {
    if (orbitingEmitterDemo) {
      orbitingEmitterDemo.system.dispose();
      particles.systems.delete(orbitingEmitterDemo.system);
      orbitingEmitterDemo = undefined;
    }
    const system = particles.spawn(name, { position: spawnPosition });
    orbitingEmitterDemo = {
      system,
      center: spawnPosition.clone(),
      angle: 0,
      radius: 3.8,
      speed: 0.65,
      height: Math.max(0.35, spawnPosition.y + 0.7),
    };
    return;
  }

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

function colorBySpeedGradientFromPreset(gradient: Gradient | undefined): GradientStopsValue {
  const colors = gradient?.map(([t, c]) => [t, colorHex(c)] as [number, string]);
  return normalizeGradientStops({
    colors: colors && colors.length >= 2 ? colors : defaultGradientStops().colors,
    opacities: defaultGradientStops().opacities,
  });
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
    customParams.velocityYMin = Array.isArray(start.velocity) && typeof start.velocity[1] === "number" ? start.velocity[1] : 0;
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
  customParams.noiseScrollX = forces?.noise?.scroll?.[0] ?? 0.2;
  customParams.noiseScrollY = forces?.noise?.scroll?.[1] ?? 0.35;
  customParams.noiseScrollZ = forces?.noise?.scroll?.[2] ?? 0.17;
  customParams.noiseOctaves = forces?.noise?.octaves ?? 2;
  customParams.noiseLacunarity = forces?.noise?.lacunarity ?? 2;
  customParams.noisePersistence = forces?.noise?.persistence ?? 0.5;
  customParams.vortexCenterX = forces?.vortex?.center?.[0] ?? 0;
  customParams.vortexCenterY = forces?.vortex?.center?.[1] ?? 0;
  customParams.vortexCenterZ = forces?.vortex?.center?.[2] ?? 0;
  customParams.vortexAxisX = forces?.vortex?.axis?.[0] ?? 0;
  customParams.vortexAxisY = forces?.vortex?.axis?.[1] ?? 1;
  customParams.vortexAxisZ = forces?.vortex?.axis?.[2] ?? 0;
  customParams.vortexOrbitalSpeed = forces?.vortex?.orbitalSpeed ?? 0;
  customParams.vortexInward = forces?.vortex?.inward ?? 0;
  customParams.vortexUpward = forces?.vortex?.upward ?? 0;

  const cbs = preset.colorBySpeed;
  customParams.colorBySpeedEnabled = !!cbs;
  if (cbs) {
    customParams.colorBySpeedMin = cbs.speedRange[0];
    customParams.colorBySpeedMax = cbs.speedRange[1];
    customParams.colorBySpeedGradient = colorBySpeedGradientFromPreset(cbs.gradient);
  } else {
    customParams.colorBySpeedGradient = defaultGradientStops();
  }

  const sbs = preset.sizeBySpeed;
  customParams.sizeBySpeedEnabled = !!sbs;
  if (sbs) {
    customParams.sizeBySpeedMin = sbs.speedRange[0];
    customParams.sizeBySpeedMax = sbs.speedRange[1];
    customParams.sizeBySpeedMulLow = curveEndpoint(sbs.curve, "first");
    customParams.sizeBySpeedMulHigh = curveEndpoint(sbs.curve, "last");
  }

  const rbs = preset.rotationBySpeed;
  customParams.rotationBySpeedEnabled = !!rbs;
  if (rbs) {
    customParams.rotationBySpeedMin = rbs.speedRange[0];
    customParams.rotationBySpeedMax = rbs.speedRange[1];
    customParams.rotationBySpeedAvLow = curveEndpoint(rbs.angularVelocity, "first");
    customParams.rotationBySpeedAvHigh = curveEndpoint(rbs.angularVelocity, "last");
  }

  const limitVelocity = preset.limitVelocityOverLifetime;
  customParams.limitVelocityEnabled = !!limitVelocity;
  customParams.limitSpeedStart = curveEndpoint(limitVelocity?.speed, "first");
  customParams.limitSpeedEnd = curveEndpoint(limitVelocity?.speed, "last");
  customParams.limitDampen = limitVelocity?.dampen ?? 1;

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
  customParams.softParticles = renderer?.softParticles ?? false;
  customParams.softness = renderer?.softness ?? 1.5;
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

function refreshRuntimeStats(): void {
  let systems = 0;
  let cpuSystems = 0;
  let gpuSystems = 0;
  let aliveTotal = 0;
  let maxTotal = 0;
  let busiest = "none";
  let busiestAlive = 0;

  for (const system of particles.systems) {
    systems++;
    if (system.backendType === "gpu") gpuSystems++;
    else cpuSystems++;
    const alive = system.aliveCount;
    const max = system.preset.maxParticles ?? (system.backendType === "gpu" ? 1024 : 256);
    aliveTotal += alive;
    maxTotal += max;
    if (alive > busiestAlive) {
      busiestAlive = alive;
      busiest = system.preset.name ?? "(unnamed)";
    }
  }

  runtimeStats.systems = systems;
  runtimeStats.cpuSystems = cpuSystems;
  runtimeStats.gpuSystems = gpuSystems;
  runtimeStats.aliveTotal = aliveTotal;
  runtimeStats.maxTotal = maxTotal;
  runtimeStats.busiest = busiest;
  runtimeStats.busiestAlive = busiestAlive;
}

function renderSceneDepthWithoutParticles(): void {
  const hiddenSystems: THREE.Object3D[] = [];
  for (const system of particles.systems) {
    const object = system as unknown as THREE.Object3D;
    if (!object.visible) continue;
    object.visible = false;
    hiddenSystems.push(object);
  }

  const previousTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(sceneDepthTarget);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);
  renderer.setRenderTarget(previousTarget);

  for (const object of hiddenSystems) object.visible = true;
}

function syncSoftParticleDepthTexture(): void {
  const depthTexture = sceneDepthTarget.depthTexture ?? null;
  const width = sceneDepthTarget.width;
  const height = sceneDepthTarget.height;
  for (const system of particles.systems) {
    system.setSoftParticleDepthTexture(depthTexture, { width, height });
  }
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
    Tornado: "tornadoDemo",
    "Orbiting emitter (world space)": "orbitingEmitterWorldDemo",
    "Rain GPU": "rainGpu",
    "Snow GPU": "snowGpu",
    "Magic aura GPU": "magicAuraGpu",
    "GPU storm": "gpuMagicStorm",
    "Speed visual (CPU)": "speedVisualDemo",
    "Candy vortex": "candyVortex",
  },
});
controlsFolder.addButton({ title: "Spawn at center" }).on("click", () => spawnEffect(customParams.clickEffect, [0, 0, 0]));
controlsFolder.addButton({ title: "Load selected into editor" }).on("click", () => loadPresetIntoEditor(customParams.clickEffect));
controlsFolder.addButton({ title: "Preview loop" }).on("click", previewCustomLoop);
controlsFolder.addButton({ title: "Clear systems" }).on("click", () => {
  particles.clear();
  loopPreview = undefined;
  orbitingEmitterDemo = undefined;
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
const vortexFolder = particlesPane.addFolder({ title: "Vortex", expanded: false }) as PaneLike;
bind(vortexFolder, "vortexCenterX", { label: "center x", min: -20, max: 20, step: 0.01 });
bind(vortexFolder, "vortexCenterY", { label: "center y", min: -20, max: 20, step: 0.01 });
bind(vortexFolder, "vortexCenterZ", { label: "center z", min: -20, max: 20, step: 0.01 });
bind(vortexFolder, "vortexAxisX", { label: "axis x", min: -1, max: 1, step: 0.01 });
bind(vortexFolder, "vortexAxisY", { label: "axis y", min: -1, max: 1, step: 0.01 });
bind(vortexFolder, "vortexAxisZ", { label: "axis z", min: -1, max: 1, step: 0.01 });
bind(vortexFolder, "vortexOrbitalSpeed", { label: "orbital", min: -30, max: 30, step: 0.01 });
bind(vortexFolder, "vortexInward", { label: "inward", min: -20, max: 20, step: 0.01 });
bind(vortexFolder, "vortexUpward", { label: "upward", min: -20, max: 20, step: 0.01 });
const limitVelocityFolder = particlesPane.addFolder({ title: "Limit Velocity over Lifetime", expanded: false }) as PaneLike;
bind(limitVelocityFolder, "limitVelocityEnabled", { label: "enabled" });
bind(limitVelocityFolder, "limitSpeedStart", { label: "speed at birth", min: 0, max: 30, step: 0.01 });
bind(limitVelocityFolder, "limitSpeedEnd", { label: "speed at death", min: 0, max: 30, step: 0.01 });
bind(limitVelocityFolder, "limitDampen", { label: "dampen", min: 0, max: 1, step: 0.01 });
const noiseFolder = particlesPane.addFolder({ title: "Noise", expanded: false }) as PaneLike;
bind(noiseFolder, "noiseStrength", { label: "strength", min: 0, max: 5, step: 0.01 });
bind(noiseFolder, "noiseFrequency", { label: "frequency", min: 0.1, max: 20, step: 0.1 });
bind(noiseFolder, "noiseScrollX", { label: "scroll x", min: -5, max: 5, step: 0.01 });
bind(noiseFolder, "noiseScrollY", { label: "scroll y", min: -5, max: 5, step: 0.01 });
bind(noiseFolder, "noiseScrollZ", { label: "scroll z", min: -5, max: 5, step: 0.01 });
bind(noiseFolder, "noiseOctaves", { label: "octaves", min: 1, max: 4, step: 1 });
bind(noiseFolder, "noiseLacunarity", { label: "lacunarity", min: 1, max: 4, step: 0.05 });
bind(noiseFolder, "noisePersistence", { label: "persistence", min: 0.05, max: 1, step: 0.01 });

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

const colorBySpeedFolder = particlesPane.addFolder({ title: "Color by speed", expanded: false }) as PaneLike;
bind(colorBySpeedFolder, "colorBySpeedEnabled", { label: "enabled" });
bind(colorBySpeedFolder, "colorBySpeedMin", { label: "speed min", min: 0, max: 40, step: 0.05 });
bind(colorBySpeedFolder, "colorBySpeedMax", { label: "speed max", min: 0, max: 40, step: 0.05 });
bind(colorBySpeedFolder, "colorBySpeedGradient", { label: "gradient", view: "gradient" });

const sizeBySpeedFolder = particlesPane.addFolder({ title: "Size by speed", expanded: false }) as PaneLike;
bind(sizeBySpeedFolder, "sizeBySpeedEnabled", { label: "enabled" });
bind(sizeBySpeedFolder, "sizeBySpeedMin", { label: "speed min", min: 0, max: 40, step: 0.05 });
bind(sizeBySpeedFolder, "sizeBySpeedMax", { label: "speed max", min: 0, max: 40, step: 0.05 });
bind(sizeBySpeedFolder, "sizeBySpeedMulLow", { label: "mult at low speed", min: 0, max: 5, step: 0.01 });
bind(sizeBySpeedFolder, "sizeBySpeedMulHigh", { label: "mult at high speed", min: 0, max: 5, step: 0.01 });

const rotationBySpeedFolder = particlesPane.addFolder({ title: "Rotation by speed", expanded: false }) as PaneLike;
bind(rotationBySpeedFolder, "rotationBySpeedEnabled", { label: "enabled" });
bind(rotationBySpeedFolder, "rotationBySpeedMin", { label: "speed min", min: 0, max: 40, step: 0.05 });
bind(rotationBySpeedFolder, "rotationBySpeedMax", { label: "speed max", min: 0, max: 40, step: 0.05 });
bind(rotationBySpeedFolder, "rotationBySpeedAvLow", { label: "rad/s at low speed", min: -30, max: 30, step: 0.05 });
bind(rotationBySpeedFolder, "rotationBySpeedAvHigh", { label: "rad/s at high speed", min: -30, max: 30, step: 0.05 });

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
bind(rendererFolder, "softParticles", { label: "soft particles" });
bind(rendererFolder, "softness", { min: 0.1, max: 8, step: 0.05 });

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
  return event.target instanceof Element && !!event.target.closest(".ui, .tweakpane-wrap, .tweakpane-wrap-scene, .tweakpane-wrap-capture");
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
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  fpsGraph.begin();
  const dt = Math.min(clock.getDelta(), 1 / 30);
  if (capturePaneParams.orbitCamera) {
    targetOrbit.theta += THREE.MathUtils.degToRad(capturePaneParams.orbitSpeedDegPerSecond) * dt;
  }
  if (orbitingEmitterDemo) {
    if (orbitingEmitterDemo.system.isDisposed) {
      orbitingEmitterDemo = undefined;
    } else {
      orbitingEmitterDemo.angle += dt * orbitingEmitterDemo.speed;
      const x = orbitingEmitterDemo.center.x + Math.cos(orbitingEmitterDemo.angle) * orbitingEmitterDemo.radius;
      const z = orbitingEmitterDemo.center.z + Math.sin(orbitingEmitterDemo.angle) * orbitingEmitterDemo.radius;
      (orbitingEmitterDemo.system as unknown as THREE.Object3D).position.set(x, orbitingEmitterDemo.height, z);
    }
  }
  updateCameraOrbit();
  particles.update(dt, camera);
  renderSceneDepthWithoutParticles();
  syncSoftParticleDepthTexture();
  runtimeStatsRefreshElapsed += dt;
  if (runtimeStatsRefreshElapsed >= 0.2) {
    refreshRuntimeStats();
    runtimeStatsRefreshElapsed = 0;
  }
  renderer.render(scene, camera);
  fpsGraph.end();
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  sceneDepthTarget.dispose();
  sceneDepthTarget = createSceneDepthTarget();
});
