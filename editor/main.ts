import * as THREE from "three";
import { Pane } from "tweakpane";
import * as EssentialsPlugin from "@tweakpane/plugin-essentials";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Wisp, collectParticlePresetIssues } from "../src";
import type { Curve, Gradient, ParticlePreset, ParticleSystem } from "../src";
import {
  defaultGradientStops,
  normalizeGradientStops,
  tweakpaneGradientPluginBundle,
  type GradientStopsValue,
} from "../demo/tweakpane-gradient-plugin/index.js";
import "./style.css";

type NumberRange = [number, number];
type CubicBezierTuple = [number, number, number, number];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function clonePreset<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clonePreset(item)) as T;
  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) next[k] = clonePreset(v);
    return next as T;
  }
  return value;
}

function asRange(value: number | NumberRange | undefined, fallback: NumberRange): NumberRange {
  if (Array.isArray(value)) return value;
  if (typeof value === "number") return [value, value];
  return fallback;
}

function curveFromEndpoints(start: number, end: number): Curve {
  return [
    [0, start],
    [1, end],
  ];
}

function cubicBezierPoint(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return (u * u * u * p0)
    + (3 * u * u * t * p1)
    + (3 * u * t * t * p2)
    + (t * t * t * p3);
}

function cubicBezierSlope(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return (3 * u * u * (p1 - p0))
    + (6 * u * t * (p2 - p1))
    + (3 * t * t * (p3 - p2));
}

function cubicBezierEaseAt(t: number, bezier: CubicBezierTuple): number {
  const [x1, y1, x2, y2] = bezier;
  const targetX = Math.min(1, Math.max(0, t));

  // Invert x(u)=targetX with a few Newton steps, then safe bisection fallback.
  let u = targetX;
  for (let i = 0; i < 6; i++) {
    const x = cubicBezierPoint(0, x1, x2, 1, u);
    const dx = cubicBezierSlope(0, x1, x2, 1, u);
    const err = x - targetX;
    if (Math.abs(err) < 1e-6) break;
    if (Math.abs(dx) < 1e-7) break;
    u -= err / dx;
    u = Math.min(1, Math.max(0, u));
  }

  const testX = cubicBezierPoint(0, x1, x2, 1, u);
  if (!Number.isFinite(testX) || Math.abs(testX - targetX) > 1e-4) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) * 0.5;
      const midX = cubicBezierPoint(0, x1, x2, 1, mid);
      if (midX < targetX) lo = mid;
      else hi = mid;
    }
    u = (lo + hi) * 0.5;
  }

  const y = cubicBezierPoint(0, y1, y2, 1, u);
  return Number.isFinite(y) ? y : targetX;
}

function curveFromBezierRange(start: number, end: number, bezier: CubicBezierTuple, samples = 5): Curve {
  const count = Math.max(2, samples);
  const curve: Curve = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const eased = cubicBezierEaseAt(t, bezier);
    const value = THREE.MathUtils.lerp(start, end, eased);
    curve.push([t, Number.isFinite(value) ? value : start]);
  }
  return curve;
}

function normalizeCubicBezierValue(value: unknown, fallback: CubicBezierTuple): CubicBezierTuple {
  if (Array.isArray(value) && value.length === 4) {
    const tuple = value.map((v) => Number(v)) as CubicBezierTuple;
    if (tuple.every((v) => Number.isFinite(v))) return tuple;
  }
  if (value && typeof value === "object") {
    const candidate = value as {
      x1?: unknown;
      y1?: unknown;
      x2?: unknown;
      y2?: unknown;
      x?: unknown;
      y?: unknown;
      z?: unknown;
      w?: unknown;
    };
    const fromNamed: CubicBezierTuple = [
      Number(candidate.x1),
      Number(candidate.y1),
      Number(candidate.x2),
      Number(candidate.y2),
    ];
    if (fromNamed.every((v) => Number.isFinite(v))) return fromNamed;
    const fromXYZW: CubicBezierTuple = [
      Number(candidate.x),
      Number(candidate.y),
      Number(candidate.z),
      Number(candidate.w),
    ];
    if (fromXYZW.every((v) => Number.isFinite(v))) return fromXYZW;
  }
  return fallback;
}

function gradientToStops(gradient: Gradient | undefined, fallbackOpacity: Curve | undefined): GradientStopsValue {
  const colors = gradient?.map(([t, c]) => [t, new THREE.Color(c).getStyle()] as [number, string]);
  const opacities = fallbackOpacity?.map(([t, v]) => [t, v] as [number, number]);
  return normalizeGradientStops({
    colors: colors && colors.length >= 2 ? colors : defaultGradientStops().colors,
    opacities: opacities && opacities.length >= 2 ? opacities : defaultGradientStops().opacities,
  });
}

function makeSoftDiscTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function makeHardDiscTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
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
  ctx.fillRect(-size / 2, -4, size, 8);
  return new THREE.CanvasTexture(canvas);
}

function makeCheckerTexture(options?: { squares?: number; colorA?: string; colorB?: string }): THREE.Texture {
  const squares = Math.max(2, Math.floor(options?.squares ?? 8));
  const colorA = options?.colorA ?? "#dbdbdb";
  const colorB = options?.colorB ?? "#bbbbbb";
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cell = size / squares;
  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");
app.innerHTML = `
  <canvas id="viewport-canvas"></canvas>
  <div id="pane-editor" class="pane-dock pane-dock-left"></div>
  <div id="pane-json" class="pane-dock pane-dock-right"></div>
  <div id="pane-diagnostics" class="pane-dock pane-dock-bottom"></div>
  <div id="pane-debug" class="pane-dock pane-dock-bottom-right"></div>
`;
const canvas = document.querySelector<HTMLCanvasElement>("#viewport-canvas")!;
const editorPaneHost = document.querySelector<HTMLDivElement>("#pane-editor")!;
const jsonPaneHost = document.querySelector<HTMLDivElement>("#pane-json")!;
const diagnosticsPaneHost = document.querySelector<HTMLDivElement>("#pane-diagnostics")!;
const debugPaneHost = document.querySelector<HTMLDivElement>("#pane-debug")!;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#20242d");
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
const orbitTarget = new THREE.Vector3(0, 0, 0);
const orbitOffset = new THREE.Vector3(0, 2.8, 6.5).sub(orbitTarget);
const orbit = new THREE.Spherical().setFromVector3(orbitOffset);
const orbitOffsetTemp = new THREE.Vector3();
camera.position.copy(orbitTarget).add(orbitOffsetTemp.setFromSpherical(orbit));
camera.lookAt(orbitTarget);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.target.copy(orbitTarget);
orbitControls.enableDamping = true;
orbitControls.enablePan = false;
orbitControls.enableZoom = false;
orbitControls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
orbitControls.touches.ONE = THREE.TOUCH.ROTATE;
orbitControls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
orbitControls.minDistance = 0.5;
orbitControls.maxDistance = 80;
orbitControls.update();

canvas.addEventListener(
  "wheel",
  (ev) => {
    if (!ev.metaKey) return;
    ev.preventDefault();
    const offset = camera.position.clone().sub(orbitControls.target);
    const distance = offset.length();
    const zoomScale = Math.exp(ev.deltaY * 0.0015);
    const nextDistance = THREE.MathUtils.clamp(distance * zoomScale, orbitControls.minDistance, orbitControls.maxDistance);
    if (distance > 1e-6) {
      offset.multiplyScalar(nextDistance / distance);
      camera.position.copy(orbitControls.target).add(offset);
      orbitControls.update();
    }
  },
  { passive: false }
);

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

scene.add(new THREE.HemisphereLight("#cdd8ff", "#404047", 1.8));
const key = new THREE.DirectionalLight("#ffffff", 2.2);
key.position.set(3, 5, 4);
scene.add(key);

const checker = makeCheckerTexture({ squares: 8, colorA: "#a1a1a1", colorB: "#bbbbbb" });
checker.repeat.set(2, 2);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.MeshStandardMaterial({ map: checker, roughness:1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
// scene.add(new THREE.GridHelper(16, 16, "#5a6072", "#404654"));

const wisp = new Wisp({
  scene,
  camera,
  particles: { renderer },
});

const softDisc = makeSoftDiscTexture();
const hardDisc = makeHardDiscTexture();
const spark = makeSparkTexture();

const defaultPresetTemplate: ParticlePreset = {
  simulation: "auto",
  simulationSpace: "local",
  maxParticles: 512,
  duration: 1.5,
  loop: true,
  prewarm: false,
  emitter: { type: "cone", radius: 0.25, angle: 22, length: 1.25 },
  emission: { rateOverTime: 5 },
  start: {
    lifetime: [0.8, 1.4],
    speed: [0.4, 1.8],
    size: [1, 1],
    color: "#ffffff",
    opacity: [1, 1],
  },
  forces: {
    acceleration: [0, 0.2, 0],
    drag: 0.6,
    noise: { strength: 0.2, frequency: 6 },
  },
  velocityOverLifetime: {
    linear: {
      y: [
        [0, 0],
        [1, 0.4],
      ],
    },
  },
  overLifetime: {
    size: [
      [0, 1],
      [1, 0],
    ],
    opacity: [
      [0, 0],
      [0.1, 1],
      [1, 0],
    ],
  },
  renderer: {
    texture: hardDisc,
    blendMode: "alpha",
    align: "camera",
    sorting: "distance",
    depthWrite: false,
  },
};

let baselinePreset = clonePreset(defaultPresetTemplate);
let workingPreset = clonePreset(defaultPresetTemplate);
let activeSystem: ParticleSystem | undefined;
let isRefreshingPane = false;
let customRendererTexture: THREE.Texture | undefined;
let customRendererTextureObjectUrl: string | undefined;
let rendererSheetPreviewCanvas: HTMLCanvasElement | null = null;
let customDispersalTexture: THREE.Texture | undefined;
let customDispersalTextureObjectUrl: string | undefined;
let dispersalPreviewCanvas: HTMLCanvasElement | null = null;

function ensureEmitter(preset: ParticlePreset): NonNullable<ParticlePreset["emitter"]> {
  if (!preset.emitter) preset.emitter = { type: "sphere", radius: 0.4, emitFrom: "volume" };
  return preset.emitter;
}
function ensureStart(preset: ParticlePreset): NonNullable<ParticlePreset["start"]> {
  if (!preset.start) preset.start = {};
  return preset.start;
}
function ensureEmission(preset: ParticlePreset): NonNullable<ParticlePreset["emission"]> {
  if (!preset.emission) preset.emission = {};
  return preset.emission;
}

function createSafePresetSerializer() {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown): unknown => {
    if (value instanceof THREE.Texture) return `[Texture:${value.name || value.uuid}]`;
    if (typeof value === "function") return undefined;
    if (value && typeof value === "object") {
      if (seen.has(value as object)) return "[Circular]";
      seen.add(value as object);
    }
    return value;
  };
}

function stringifyPreset(preset: ParticlePreset, pretty = false): string {
  return JSON.stringify(preset, createSafePresetSerializer(), pretty ? 2 : undefined);
}

const PRESET_TOP_LEVEL_KEYS = new Set([
  "name",
  "simulation",
  "simulationSpace",
  "bounds",
  "maxParticles",
  "duration",
  "loop",
  "prewarm",
  "autoDispose",
  "gpu",
  "emitter",
  "emission",
  "start",
  "forces",
  "velocityOverLifetime",
  "overLifetime",
  "limitVelocityOverLifetime",
  "colorBySpeed",
  "sizeBySpeed",
  "rotationBySpeed",
  "renderer",
  "collision",
  "subEmitters",
  "inheritVelocity",
  "lifetimeByEmitterSpeed",
]);

function looksLikePresetCandidate(value: unknown): value is ParticlePreset {
  if (!isPlainObject(value)) return false;
  return Object.keys(value).some((key) => PRESET_TOP_LEVEL_KEYS.has(key));
}

function extractPresetFromJsonValue(value: unknown): ParticlePreset | undefined {
  if (looksLikePresetCandidate(value)) return value;
  if (!isPlainObject(value)) return undefined;

  const wrappedCandidateKeys = ["preset", "effect", "particle", "particlePreset"];
  for (const key of wrappedCandidateKeys) {
    const candidate = (value as Record<string, unknown>)[key];
    if (looksLikePresetCandidate(candidate)) return candidate;
  }

  const collectionKeys = ["presets", "effects"];
  for (const key of collectionKeys) {
    const collection = (value as Record<string, unknown>)[key];
    if (Array.isArray(collection)) {
      const first = collection.find((item) => looksLikePresetCandidate(item));
      if (first) return first as ParticlePreset;
    } else if (isPlainObject(collection)) {
      const first = Object.values(collection).find((item) => looksLikePresetCandidate(item));
      if (first) return first as ParticlePreset;
    }
  }

  const directValues = Object.values(value);
  const firstPreset = directValues.find((item) => looksLikePresetCandidate(item));
  return firstPreset as ParticlePreset | undefined;
}

function parsePresetInput(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Allow pasting JS/TS object literals copied from source files
    // (unquoted keys, trailing commas, single quotes).
    return Function(
      "softDisc",
      "hardDisc",
      "spark",
      `"use strict"; return (${text});`
    )(softDisc, hardDisc, spark) as unknown;
  }
}

function sanitizeImportedPreset(preset: ParticlePreset): { preset: ParticlePreset; warnings: string[] } {
  const next = clonePreset(preset);
  const warnings: string[] = [];

  const rendererTexture = next.renderer?.texture;
  if (rendererTexture !== undefined && !(rendererTexture instanceof THREE.Texture)) {
    if (next.renderer) delete next.renderer.texture;
    warnings.push("renderer.texture was a serialized/non-live texture object and was removed.");
  }

  const dispersalTexture = next.renderer?.dispersal?.texture;
  if (dispersalTexture !== undefined && !(dispersalTexture instanceof THREE.Texture)) {
    if (next.renderer?.dispersal) delete next.renderer.dispersal.texture;
    warnings.push("renderer.dispersal.texture was a serialized/non-live texture object and was removed.");
  }

  return { preset: next, warnings };
}

function refreshPaneSafely(): void {
  isRefreshingPane = true;
  pane.refresh();
  isRefreshingPane = false;
}

function setFolderTitleEnabledState(folder: unknown, enabled: boolean): void {
  const element = (folder as { element?: HTMLElement }).element;
  if (!element) return;
  element.classList.toggle("folder-title-dimmed", !enabled);
  const titleRow = element.querySelector<HTMLElement>(".tp-fldv_t");
  if (titleRow) titleRow.style.opacity = enabled ? "1" : "0.5";
}

const params = {
  presetName: "customEffect",
  simulationSpace: "local" as "local" | "world",
  simulation: "auto" as "auto" | "cpu" | "gpu",
  maxParticles: 256,
  duration: 1,
  loop: true,
  prewarm: false,
  emitterType: "cone" as "point" | "sphere" | "hemisphere" | "cone" | "box",
  emitterBoxSize: { x: 1, y: 1, z: 1 },
  emitterRadius: 0.4,
  emitterEmitFrom: "volume" as "volume" | "shell",
  emitterAngle: 25,
  emitterLength: 1,
  emissionMode: "rate" as "rate" | "burst",
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
  startColorMode: "single" as "single" | "range",
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
  rendererType: "billboard" as "billboard" | "stretchedBillboard",
  rendererBlendMode: "alpha" as "alpha" | "additive" | "multiply",
  rendererAlign: "camera" as "camera" | "velocity",
  rendererSorting: "distance" as "none" | "distance" | "youngestFirst" | "oldestFirst",
  rendererTexture: "hardDisc" as "softDisc" | "hardDisc" | "spark",
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
  rendererTextureSheetAnimationMode: "overLifetime" as "static" | "randomStart" | "overLifetime" | "randomStartOverLifetime",
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
  sizeOverLifetimeBezier: [0.33, 0, 0.66, 1] as [number, number, number, number],
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
  rawJson: "",
  diagnostics: "No validation issues.",
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
const globalDebugParams = {
  enabled: false,
  playbackTime: 0,
  autoOrbit: false,
  orbitSpeedDegPerSec: 18,
};
let runtimeStatsRefreshElapsed = 0;
let debugPlaybackDuration = Math.max(0.01, workingPreset.duration ?? 1);
let debugPlaybackMode: "play" | "pause" = "play";
let debugPlaybackBinding:
  | {
    dispose?: () => void;
    label?: string;
    on?: (event: string, handler: (ev: { value: number; last?: boolean }) => void) => void;
  }
  | undefined;

function respawn(): void {
  if (!wisp.particles) return;
  if (activeSystem) activeSystem.dispose();
  wisp.particles.register("editorWorking", workingPreset);
  activeSystem = wisp.particles.spawn("editorWorking", { position: [0, 0.02, 0] });
}

function syncParamsFromPreset(): void {
  const start = ensureStart(workingPreset);
  const emission = ensureEmission(workingPreset);
  const emitter = ensureEmitter(workingPreset);
  const life = asRange(start.lifetime, [0.8, 1.2]);
  const speed = asRange(start.speed, [0.3, 1.5]);
  const size = asRange(start.size, [0.08, 0.22]);
  const burst = asRange(emission.bursts?.[0]?.count, [18, 32]);
  const firstBurst = emission.bursts?.[0];

  params.simulation = (workingPreset.simulation ?? "auto") as "auto" | "cpu" | "gpu";
  params.simulationSpace = (workingPreset.simulationSpace ?? "local") as "local" | "world";
  params.maxParticles = workingPreset.maxParticles ?? 256;
  params.duration = workingPreset.duration ?? 1;
  params.loop = workingPreset.loop ?? true;
  params.prewarm = workingPreset.prewarm ?? false;
  params.emitterType = emitter.type;
  params.emitterRadius = (emitter as { radius?: number }).radius ?? 0.4;
  params.emitterEmitFrom = ((emitter as { emitFrom?: "volume" | "shell" }).emitFrom ?? "volume");
  params.emitterAngle = (emitter as { angle?: number }).angle ?? 25;
  params.emitterLength = (emitter as { length?: number }).length ?? 1;
  const boxSize = (emitter as { size?: [number, number, number] }).size ?? [1, 1, 1];
  params.emitterBoxSize = { x: boxSize[0], y: boxSize[1], z: boxSize[2] };
  params.emissionMode = firstBurst ? "burst" : "rate";
  params.burstCount = { x: burst[0], y: burst[1] };
  params.burstTime = firstBurst?.time ?? 0;
  params.burstProbability = firstBurst?.probability ?? 1;
  params.rateOverTime = typeof emission.rateOverTime === "number" ? emission.rateOverTime : 0;
  params.lifetimeRange = { x: life[0], y: life[1] };
  params.speedRange = { x: speed[0], y: speed[1] };
  params.sizeRange = { x: size[0], y: size[1] };
  const opacity = asRange(start.opacity, [1, 1]);
  params.opacityRange = { x: opacity[0], y: opacity[1] };
  const rotation = asRange(start.rotation, [0, 0]);
  params.startRotationRange = { x: rotation[0], y: rotation[1] };
  const angularVelocity = asRange(start.angularVelocity, [0, 0]);
  params.startAngularVelocityRange = { x: angularVelocity[0], y: angularVelocity[1] };
  const color = start.color;
  if (Array.isArray(color)) {
    params.startColorMode = "range";
    params.startColorA = new THREE.Color(color[0]).getStyle();
    params.startColorB = new THREE.Color(color[1]).getStyle();
  } else {
    params.startColorMode = "single";
    params.startColorA = new THREE.Color(color ?? "#ffffff").getStyle();
    params.startColorB = params.startColorA;
  }
  params.drag = workingPreset.forces?.drag ?? 0;
  const accel = workingPreset.forces?.acceleration ?? [0, 0, 0];
  params.acceleration = { x: accel[0], y: accel[1], z: accel[2] };
  const vortex = workingPreset.forces?.vortex;
  params.vortexEnabled = !!vortex;
  params.vortexCenter = {
    x: vortex?.center?.[0] ?? 0,
    y: vortex?.center?.[1] ?? 0,
    z: vortex?.center?.[2] ?? 0,
  };
  params.vortexAxis = {
    x: vortex?.axis?.[0] ?? 0,
    y: vortex?.axis?.[1] ?? 1,
    z: vortex?.axis?.[2] ?? 0,
  };
  params.vortexOrbitalSpeed = vortex?.orbitalSpeed ?? 0;
  params.vortexInward = vortex?.inward ?? 0;
  params.vortexUpward = vortex?.upward ?? 0;
  const noise = workingPreset.forces?.noise;
  params.noiseEnabled = !!noise;
  params.noiseStrength = workingPreset.forces?.noise?.strength ?? 0;
  params.noiseFrequency = workingPreset.forces?.noise?.frequency ?? 1;
  params.noiseScroll = {
    x: noise?.scroll?.[0] ?? 0,
    y: noise?.scroll?.[1] ?? 0,
    z: noise?.scroll?.[2] ?? 0,
  };
  params.noiseOctaves = noise?.octaves ?? 1;
  params.noiseLacunarity = noise?.lacunarity ?? 2;
  params.noisePersistence = noise?.persistence ?? 0.5;
  const linear = workingPreset.velocityOverLifetime?.linear;
  params.velocityOverLifetimeEnabled = !!linear;
  params.velocityLinearX = { x: linear?.x?.[0]?.[1] ?? 0, y: linear?.x?.[linear.x.length - 1]?.[1] ?? 0 };
  params.velocityLinearY = { x: linear?.y?.[0]?.[1] ?? 0, y: linear?.y?.[linear.y.length - 1]?.[1] ?? 0 };
  params.velocityLinearZ = { x: linear?.z?.[0]?.[1] ?? 0, y: linear?.z?.[linear.z.length - 1]?.[1] ?? 0 };
  params.rendererType = (workingPreset.renderer?.type ?? "billboard") as "billboard" | "stretchedBillboard";
  params.rendererBlendMode = (workingPreset.renderer?.blendMode ?? "alpha") as "alpha" | "additive" | "multiply";
  params.rendererAlign = (workingPreset.renderer?.align ?? "camera") as "camera" | "velocity";
  params.rendererSorting = (workingPreset.renderer?.sorting ?? "distance") as "none" | "distance" | "youngestFirst" | "oldestFirst";
  const rendererTexture = workingPreset.renderer?.texture;
  if (rendererTexture === hardDisc || rendererTexture === spark || rendererTexture === softDisc || !rendererTexture) {
    customRendererTexture = undefined;
    params.rendererTexture = rendererTexture === hardDisc ? "hardDisc" : rendererTexture === spark ? "spark" : "softDisc";
    params.rendererTextureSheetTextureName = "Built-in";
  } else if (rendererTexture instanceof THREE.Texture) {
    customRendererTexture = rendererTexture;
    params.rendererTexture = "softDisc";
    params.rendererTextureSheetTextureName = "Custom sheet";
  } else {
    customRendererTexture = undefined;
    params.rendererTexture = "softDisc";
    params.rendererTextureSheetTextureName = "Built-in";
  }
  params.rendererStretchFactor = workingPreset.renderer?.stretchFactor ?? 0.35;
  params.rendererStretchMaxScale = workingPreset.renderer?.stretchMaxScale ?? 4;
  params.rendererDepthWrite = workingPreset.renderer?.depthWrite ?? false;
  params.rendererDepthTest = workingPreset.renderer?.depthTest ?? true;
  params.rendererSoftParticles = workingPreset.renderer?.softParticles ?? false;
  params.rendererSoftness = workingPreset.renderer?.softness ?? 1.5;
  params.rendererAlphaFromLuminanceEnabled = workingPreset.renderer?.alphaFromLuminance?.enabled ?? false;
  params.rendererAlphaFromLuminanceBlackCutoff = workingPreset.renderer?.alphaFromLuminance?.blackCutoff ?? 32;
  params.rendererTextureSheetEnabled = !!workingPreset.renderer?.textureSheet;
  params.rendererTextureSheetColumns = workingPreset.renderer?.textureSheet?.columns ?? 2;
  params.rendererTextureSheetRows = workingPreset.renderer?.textureSheet?.rows ?? 2;
  params.rendererTextureSheetAnimationMode = (
    workingPreset.renderer?.textureSheet?.animationMode ?? "overLifetime"
  ) as "static" | "randomStart" | "overLifetime" | "randomStartOverLifetime";
  const dispersal = workingPreset.renderer?.dispersal;
  params.dispersalEnabled = dispersal ? (dispersal.enabled ?? true) : false;
  params.dispersalStrength = dispersal?.strength ?? 1;
  params.dispersalAmount = {
    x: dispersal?.amount?.[0]?.[1] ?? 0,
    y: dispersal?.amount?.[dispersal.amount.length - 1]?.[1] ?? 1,
  };
  params.dispersalStartAt = dispersal?.amount && dispersal.amount.length >= 3
    ? THREE.MathUtils.clamp(dispersal.amount[1][0], 0, 1)
    : 0;
  params.dispersalNoiseScale = dispersal?.noiseScale ?? 6;
  params.dispersalEdgeSoftness = dispersal?.edgeSoftness ?? 0.12;
  params.dispersalScroll = {
    x: dispersal?.scroll?.[0] ?? 0,
    y: dispersal?.scroll?.[1] ?? 0,
  };
  customDispersalTexture = dispersal?.texture;
  params.dispersalTextureName = dispersal?.texture ? "Custom texture" : "Built-in noise";
  const sizeCurve = workingPreset.overLifetime?.size;
  params.sizeOverLifetimeEnabled = !!sizeCurve;
  params.sizeOverLifetime = { x: sizeCurve?.[0]?.[1] ?? 1, y: sizeCurve?.[sizeCurve.length - 1]?.[1] ?? 0 };
  params.sizeOverLifetimeBezier = normalizeCubicBezierValue(
    [0.33, sizeCurve?.[1]?.[1] ?? 0, 0.66, sizeCurve?.[2]?.[1] ?? 1],
    [0.33, 0, 0.66, 1]
  );
  params.colorOverLifetimeEnabled = !!workingPreset.overLifetime?.color || !!workingPreset.overLifetime?.opacity;
  params.lifetimeGradient = gradientToStops(workingPreset.overLifetime?.color, workingPreset.overLifetime?.opacity);

  const limitVel = workingPreset.limitVelocityOverLifetime;
  params.limitVelocityEnabled = !!limitVel;
  params.limitVelocitySpeed = {
    x: limitVel?.speed?.[0]?.[1] ?? 5,
    y: limitVel?.speed?.[limitVel.speed.length - 1]?.[1] ?? 5,
  };
  params.limitVelocityDampen = limitVel?.dampen ?? 1;

  const cbs = workingPreset.colorBySpeed;
  params.colorBySpeedEnabled = !!cbs;
  params.colorBySpeedRange = { x: cbs?.speedRange?.[0] ?? 0, y: cbs?.speedRange?.[1] ?? 10 };
  params.colorBySpeedGradient = normalizeGradientStops({
    colors: cbs?.gradient?.map(([t, c]) => [t, new THREE.Color(c).getStyle()] as [number, string]) ?? defaultGradientStops().colors,
    opacities: defaultGradientStops().opacities,
  });

  const sbs = workingPreset.sizeBySpeed;
  params.sizeBySpeedEnabled = !!sbs;
  params.sizeBySpeedRange = { x: sbs?.speedRange?.[0] ?? 0, y: sbs?.speedRange?.[1] ?? 10 };
  params.sizeBySpeedMultiplier = {
    x: sbs?.curve?.[0]?.[1] ?? 1,
    y: sbs?.curve?.[sbs.curve.length - 1]?.[1] ?? 1,
  };

  const rbs = workingPreset.rotationBySpeed;
  params.rotationBySpeedEnabled = !!rbs;
  params.rotationBySpeedRange = { x: rbs?.speedRange?.[0] ?? 0, y: rbs?.speedRange?.[1] ?? 10 };
  params.rotationBySpeedAngular = {
    x: rbs?.angularVelocity?.[0]?.[1] ?? 0,
    y: rbs?.angularVelocity?.[rbs.angularVelocity.length - 1]?.[1] ?? 0,
  };
  params.rawJson = stringifyPreset(workingPreset, true);
}

function applyParamsToPreset(): void {
  const start = ensureStart(workingPreset);
  const emission = ensureEmission(workingPreset);
  const emitter = ensureEmitter(workingPreset);
  const forces = (workingPreset.forces ??= {});
  const rendererConfig = (workingPreset.renderer ??= {});
  const overLifetime = (workingPreset.overLifetime ??= {});

  workingPreset.simulation = params.simulation;
  workingPreset.simulationSpace = params.simulationSpace;
  workingPreset.maxParticles = Math.max(1, Math.round(params.maxParticles));
  workingPreset.duration = Math.max(0.01, params.duration);
  workingPreset.loop = params.loop;
  workingPreset.prewarm = params.prewarm;
  emitter.type = params.emitterType;
  if (emitter.type === "sphere" || emitter.type === "hemisphere") {
    (emitter as { emitFrom?: "volume" | "shell" }).emitFrom = params.emitterEmitFrom;
  }
  (emitter as { radius?: number }).radius = Math.max(0, params.emitterRadius);
  if (emitter.type === "cone") {
    (emitter as { angle?: number }).angle = Math.max(0, params.emitterAngle);
    (emitter as { length?: number }).length = Math.max(0, params.emitterLength);
  }
  if (emitter.type === "box") {
    (emitter as { size?: [number, number, number] }).size = [
      Math.max(0, params.emitterBoxSize.x),
      Math.max(0, params.emitterBoxSize.y),
      Math.max(0, params.emitterBoxSize.z),
    ];
  }
  if (params.emissionMode === "burst") {
    emission.bursts = [{
      time: Math.max(0, params.burstTime),
      count: [Math.max(0, params.burstCount.x), Math.max(0, params.burstCount.y)],
      probability: Math.min(1, Math.max(0, params.burstProbability)),
    }];
    delete emission.rateOverTime;
  } else {
    emission.rateOverTime = Math.max(0, params.rateOverTime);
    delete emission.bursts;
  }
  start.lifetime = [Math.max(0.01, params.lifetimeRange.x), Math.max(0.01, params.lifetimeRange.y)];
  start.speed = [params.speedRange.x, params.speedRange.y];
  start.size = [Math.max(0, params.sizeRange.x), Math.max(0, params.sizeRange.y)];
  start.opacity = [Math.max(0, params.opacityRange.x), Math.min(1, Math.max(0, params.opacityRange.y))];
  start.rotation = [params.startRotationRange.x, params.startRotationRange.y];
  start.angularVelocity = [params.startAngularVelocityRange.x, params.startAngularVelocityRange.y];
  start.color = params.startColorMode === "range"
    ? [params.startColorA, params.startColorB]
    : params.startColorA;
  forces.drag = Math.max(0, params.drag);
  forces.acceleration = [params.acceleration.x, params.acceleration.y, params.acceleration.z];
  if (params.vortexEnabled) {
    forces.vortex = {
      center: [params.vortexCenter.x, params.vortexCenter.y, params.vortexCenter.z],
      axis: [params.vortexAxis.x, params.vortexAxis.y, params.vortexAxis.z],
      orbitalSpeed: params.vortexOrbitalSpeed,
      inward: params.vortexInward,
      upward: params.vortexUpward,
    };
  } else {
    delete forces.vortex;
  }
  if (params.noiseEnabled) {
    forces.noise = {
      ...(forces.noise ?? {}),
      strength: Math.max(0, params.noiseStrength),
      frequency: Math.max(0.001, params.noiseFrequency),
      scroll: [params.noiseScroll.x, params.noiseScroll.y, params.noiseScroll.z],
      octaves: Math.max(1, Math.round(params.noiseOctaves)),
      lacunarity: Math.max(0.01, params.noiseLacunarity),
      persistence: Math.max(0, params.noisePersistence),
    };
  } else {
    delete forces.noise;
  }
  rendererConfig.type = params.rendererType;
  rendererConfig.blendMode = params.rendererBlendMode;
  rendererConfig.align = params.rendererAlign;
  rendererConfig.sorting = params.rendererSorting;
  rendererConfig.texture = customRendererTexture
    ?? (params.rendererTexture === "hardDisc" ? hardDisc : params.rendererTexture === "spark" ? spark : softDisc);
  rendererConfig.depthWrite = params.rendererDepthWrite;
  rendererConfig.depthTest = params.rendererDepthTest;
  rendererConfig.softParticles = params.rendererSoftParticles;
  rendererConfig.softness = Math.max(0.01, params.rendererSoftness);
  if (params.rendererType === "stretchedBillboard") {
    rendererConfig.stretchFactor = Math.max(0, params.rendererStretchFactor);
    rendererConfig.stretchMaxScale = Math.max(1, params.rendererStretchMaxScale);
  } else {
    delete rendererConfig.stretchFactor;
    delete rendererConfig.stretchMaxScale;
  }
  if (params.rendererAlphaFromLuminanceEnabled) {
    rendererConfig.alphaFromLuminance = {
      enabled: true,
      blackCutoff: Math.min(255, Math.max(0, Math.round(params.rendererAlphaFromLuminanceBlackCutoff))),
    };
  } else {
    delete rendererConfig.alphaFromLuminance;
  }
  if (params.rendererTextureSheetEnabled) {
    rendererConfig.textureSheet = {
      columns: Math.max(1, Math.round(params.rendererTextureSheetColumns)),
      rows: Math.max(1, Math.round(params.rendererTextureSheetRows)),
      animationMode: params.rendererTextureSheetAnimationMode,
    };
  } else {
    delete rendererConfig.textureSheet;
  }
  if (params.dispersalEnabled) {
    const textureForDispersal = customDispersalTexture ?? rendererConfig.dispersal?.texture;
    const startAmount = THREE.MathUtils.clamp(params.dispersalAmount.x, 0, 1);
    const endAmount = THREE.MathUtils.clamp(params.dispersalAmount.y, 0, 1);
    const startAt = THREE.MathUtils.clamp(params.dispersalStartAt, 0, 1);
    rendererConfig.dispersal = {
      enabled: true,
      strength: Math.min(1, Math.max(0, params.dispersalStrength)),
      amount: [
        [0, startAmount],
        [startAt, startAmount],
        [1, endAmount],
      ],
      noiseScale: Math.max(0.01, params.dispersalNoiseScale),
      edgeSoftness: Math.max(0.001, params.dispersalEdgeSoftness),
      scroll: [params.dispersalScroll.x, params.dispersalScroll.y],
      ...(textureForDispersal ? { texture: textureForDispersal } : {}),
    };
  } else {
    delete rendererConfig.dispersal;
  }
  if (params.velocityOverLifetimeEnabled) {
    const velocityOverLifetime = (workingPreset.velocityOverLifetime ??= {});
    velocityOverLifetime.linear = {
      x: curveFromEndpoints(params.velocityLinearX.x, params.velocityLinearX.y),
      y: curveFromEndpoints(params.velocityLinearY.x, params.velocityLinearY.y),
      z: curveFromEndpoints(params.velocityLinearZ.x, params.velocityLinearZ.y),
    };
  } else {
    delete workingPreset.velocityOverLifetime;
  }

  if (params.sizeOverLifetimeEnabled) {
    overLifetime.size = curveFromBezierRange(
      params.sizeOverLifetime.x,
      params.sizeOverLifetime.y,
      params.sizeOverLifetimeBezier,
      5
    );
  } else {
    delete overLifetime.size;
  }

  if (params.colorOverLifetimeEnabled) {
    overLifetime.color = params.lifetimeGradient.colors.map(([t, c]) => [t, c] as [number, string]);
    overLifetime.opacity = params.lifetimeGradient.opacities.map(([t, a]) => [t, a] as [number, number]);
  } else {
    delete overLifetime.color;
    delete overLifetime.opacity;
  }

  if (params.limitVelocityEnabled) {
    workingPreset.limitVelocityOverLifetime = {
      speed: curveFromEndpoints(params.limitVelocitySpeed.x, params.limitVelocitySpeed.y),
      dampen: params.limitVelocityDampen,
    };
  } else {
    delete workingPreset.limitVelocityOverLifetime;
  }

  if (params.colorBySpeedEnabled) {
    workingPreset.colorBySpeed = {
      speedRange: [params.colorBySpeedRange.x, params.colorBySpeedRange.y],
      gradient: params.colorBySpeedGradient.colors.map(([t, c]) => [t, c] as [number, string]),
    };
  } else {
    delete workingPreset.colorBySpeed;
  }

  if (params.sizeBySpeedEnabled) {
    workingPreset.sizeBySpeed = {
      speedRange: [params.sizeBySpeedRange.x, params.sizeBySpeedRange.y],
      curve: curveFromEndpoints(params.sizeBySpeedMultiplier.x, params.sizeBySpeedMultiplier.y),
    };
  } else {
    delete workingPreset.sizeBySpeed;
  }

  if (params.rotationBySpeedEnabled) {
    workingPreset.rotationBySpeed = {
      speedRange: [params.rotationBySpeedRange.x, params.rotationBySpeedRange.y],
      angularVelocity: curveFromEndpoints(params.rotationBySpeedAngular.x, params.rotationBySpeedAngular.y),
    };
  } else {
    delete workingPreset.rotationBySpeed;
  }

  if (!overLifetime.size && !overLifetime.opacity && !overLifetime.color) {
    delete workingPreset.overLifetime;
  }
  params.rawJson = stringifyPreset(workingPreset, true);
}

function refreshRuntimeStats(): void {
  if (!wisp.particles) return;
  let systems = 0;
  let cpuSystems = 0;
  let gpuSystems = 0;
  let aliveTotal = 0;
  let maxTotal = 0;
  let busiest = "none";
  let busiestAlive = 0;

  for (const system of wisp.particles.systems) {
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

function refreshDiagnostics(): void {
  const issues = collectParticlePresetIssues(workingPreset, { renderer });
  if (issues.errors.length === 0 && issues.warnings.length === 0) {
    params.diagnostics = "No validation issues.";
  } else {
    params.diagnostics = [...issues.errors.map((e) => `error: ${e}`), ...issues.warnings.map((w) => `warn: ${w}`)]
      .slice(0, 10)
      .join(" | ");
  }
}

function renderSceneDepthWithoutParticles(): void {
  if (!wisp.particles) return;
  const hiddenSystems: THREE.Object3D[] = [];
  for (const system of wisp.particles.systems) {
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
  if (!wisp.particles) return;
  const depthTexture = sceneDepthTarget.depthTexture ?? null;
  const width = sceneDepthTarget.width;
  const height = sceneDepthTarget.height;
  for (const system of wisp.particles.systems) {
    system.setSoftParticleDepthTexture(depthTexture, { width, height });
  }
}

const pane = new Pane({ title: "Particle Editor", expanded: true, container: editorPaneHost });
pane.registerPlugin(EssentialsPlugin);
pane.registerPlugin(tweakpaneGradientPluginBundle);

const topFolder = pane.addFolder({ title: "Preset", expanded: false });
topFolder.addBinding(params, "presetName", { label: "Name", view: "text" });

const systemFolder = pane.addFolder({ title: "Particle System", expanded: false });
systemFolder.addBinding(params, "simulation", { label: "Simulation", options: { auto: "auto", cpu: "cpu", gpu: "gpu" } });
systemFolder.addBinding(params, "simulationSpace", { label: "Simulation Space", options: { local: "local", world: "world" } });
systemFolder.addBinding(params, "maxParticles", { label: "Max Particles", min: 1, max: 50000, step: 1 });
systemFolder.addBinding(params, "duration", { label: "Duration", min: 0.01, max: 60, step: 0.01 });
systemFolder.addBinding(params, "loop", { label: "Loop" });
systemFolder.addBinding(params, "prewarm", { label: "Prewarm" });

const emissionFolder = pane.addFolder({ title: "Emission", expanded: false });
const emissionModeBinding = emissionFolder.addBinding(params, "emissionMode", {
  label: "Mode",
  options: { rate: "rate", burst: "burst" },
});
const rateBinding = emissionFolder.addBinding(params, "rateOverTime", { label: "Rate Over Time", min: 0, max: 5000, step: 1 });
const burstTimeBinding = emissionFolder.addBinding(params, "burstTime", { label: "Burst Time", min: 0, max: 60, step: 0.01 });
const burstCountBinding = emissionFolder.addBinding(params, "burstCount", {
  label: "Burst count",
  x: { min: 0, max: 10000, step: 1 },
  y: { min: 0, max: 10000, step: 1 },
});
const burstProbabilityBinding = emissionFolder.addBinding(params, "burstProbability", {
  label: "Burst prob",
  min: 0,
  max: 1,
  step: 0.01,
});

function updateEmissionVisibility(): void {
  const isRate = params.emissionMode === "rate";
  rateBinding.hidden = !isRate;
  burstTimeBinding.hidden = isRate;
  burstCountBinding.hidden = isRate;
  burstProbabilityBinding.hidden = isRate;
}
emissionModeBinding.on("change", () => updateEmissionVisibility());

const emitterFolder = pane.addFolder({ title: "Emitter", expanded: false });
const emitterTypeBinding = emitterFolder.addBinding(params, "emitterType", {
  label: "Type",
  options: { point: "point", sphere: "sphere", hemisphere: "hemisphere", cone: "cone", box: "box" },
});
const emitterEmitFromBinding = emitterFolder.addBinding(params, "emitterEmitFrom", {
  label: "Emit From",
  options: { volume: "volume", shell: "shell" },
});
const emitterRadiusBinding = emitterFolder.addBinding(params, "emitterRadius", {
  label: "Radius",
  min: 0,
  max: 10,
  step: 0.01,
});
const emitterAngleBinding = emitterFolder.addBinding(params, "emitterAngle", { label: "Cone angle", min: 0, max: 89, step: 0.1 });
const emitterLengthBinding = emitterFolder.addBinding(params, "emitterLength", { label: "Cone length", min: 0, max: 20, step: 0.01 });
const emitterBoxSizeBinding = emitterFolder.addBinding(params, "emitterBoxSize", {
  label: "Box size",
  x: { min: 0, max: 20, step: 0.01 },
  y: { min: 0, max: 20, step: 0.01 },
  z: { min: 0, max: 20, step: 0.01 },
});

function updateEmitterVisibility(): void {
  const type = params.emitterType;
  const isPoint = type === "point";
  const isSphereLike = type === "sphere" || type === "hemisphere";
  const isCone = type === "cone";
  const isBox = type === "box";

  emitterEmitFromBinding.hidden = !isSphereLike;
  emitterRadiusBinding.hidden = isPoint || isBox;
  emitterAngleBinding.hidden = !isCone;
  emitterLengthBinding.hidden = !isCone;
  emitterBoxSizeBinding.hidden = !isBox;
}
emitterTypeBinding.on("change", () => updateEmitterVisibility());

const startFolder = pane.addFolder({ title: "Start", expanded: false });
startFolder.addBinding(params, "lifetimeRange", {
  label: "Lifetime",
  x: { min: 0.01, max: 30, step: 0.01 },
  y: { min: 0.01, max: 30, step: 0.01 },
});
startFolder.addBinding(params, "speedRange", {
  label: "Speed",
  x: { min: -50, max: 100, step: 0.01 },
  y: { min: -50, max: 100, step: 0.01 },
});
startFolder.addBinding(params, "sizeRange", {
  label: "Size",
  x: { min: 0, max: 10, step: 0.01 },
  y: { min: 0, max: 10, step: 0.01 },
});
startFolder.addBinding(params, "opacityRange", {
  label: "Opacity",
  x: { min: 0, max: 1, step: 0.01 },
  y: { min: 0, max: 1, step: 0.01 },
});
startFolder.addBinding(params, "startRotationRange", {
  label: "Rotation (rad)",
  x: { min: -6.283, max: 6.283, step: 0.001 },
  y: { min: -6.283, max: 6.283, step: 0.001 },
});
startFolder.addBinding(params, "startAngularVelocityRange", {
  label: "Angular Vel (rad/s)",
  x: { min: -20, max: 20, step: 0.01 },
  y: { min: -20, max: 20, step: 0.01 },
});
const startColorModeBinding = startFolder.addBinding(params, "startColorMode", {
  label: "Color Mode",
  options: { single: "single", range: "range" },
});
const startColorABinding = startFolder.addBinding(params, "startColorA", { label: "Color A" });
const startColorBBinding = startFolder.addBinding(params, "startColorB", { label: "Color B" });

function updateStartVisibility(): void {
  const isRange = params.startColorMode === "range";
  startColorBBinding.hidden = !isRange;
}
startColorModeBinding.on("change", () => updateStartVisibility());

const forcesFolder = pane.addFolder({ title: "Forces", expanded: false });
forcesFolder.addBinding(params, "drag", { label: "Drag", min: 0, max: 20, step: 0.01 });
forcesFolder.addBinding(params, "acceleration", {
  label: "Acceleration",
  x: { min: -50, max: 50, step: 0.01 },
  y: { min: -50, max: 50, step: 0.01 },
  z: { min: -50, max: 50, step: 0.01 },
});
const vortexEnabledBinding = forcesFolder.addBinding(params, "vortexEnabled", { label: "Vortex Enabled" });
const vortexCenterBinding = forcesFolder.addBinding(params, "vortexCenter", {
  label: "Vortex center",
  x: { min: -20, max: 20, step: 0.01 },
  y: { min: -20, max: 20, step: 0.01 },
  z: { min: -20, max: 20, step: 0.01 },
});
const vortexAxisBinding = forcesFolder.addBinding(params, "vortexAxis", {
  label: "Vortex axis",
  x: { min: -1, max: 1, step: 0.01 },
  y: { min: -1, max: 1, step: 0.01 },
  z: { min: -1, max: 1, step: 0.01 },
});
const vortexOrbitalBinding = forcesFolder.addBinding(params, "vortexOrbitalSpeed", { label: "Vortex Orbital Speed", min: -50, max: 50, step: 0.01 });
const vortexInwardBinding = forcesFolder.addBinding(params, "vortexInward", { label: "Vortex Inward", min: -50, max: 50, step: 0.01 });
const vortexUpwardBinding = forcesFolder.addBinding(params, "vortexUpward", { label: "Vortex Upward", min: -50, max: 50, step: 0.01 });

const noiseEnabledBinding = forcesFolder.addBinding(params, "noiseEnabled", { label: "Noise Enabled" });
const noiseStrengthBinding = forcesFolder.addBinding(params, "noiseStrength", { label: "Noise Strength", min: 0, max: 20, step: 0.01 });
const noiseFrequencyBinding = forcesFolder.addBinding(params, "noiseFrequency", { label: "Noise Frequency", min: 0.01, max: 30, step: 0.01 });
const noiseScrollBinding = forcesFolder.addBinding(params, "noiseScroll", {
  label: "Noise scroll",
  x: { min: -20, max: 20, step: 0.01 },
  y: { min: -20, max: 20, step: 0.01 },
  z: { min: -20, max: 20, step: 0.01 },
});
const noiseOctavesBinding = forcesFolder.addBinding(params, "noiseOctaves", { label: "Noise Octaves", min: 1, max: 8, step: 1 });
const noiseLacunarityBinding = forcesFolder.addBinding(params, "noiseLacunarity", { label: "Noise Lacunarity", min: 0.01, max: 8, step: 0.01 });
const noisePersistenceBinding = forcesFolder.addBinding(params, "noisePersistence", { label: "Noise Persistence", min: 0, max: 2, step: 0.01 });

function updateForcesVisibility(): void {
  vortexCenterBinding.hidden = !params.vortexEnabled;
  vortexAxisBinding.hidden = !params.vortexEnabled;
  vortexOrbitalBinding.hidden = !params.vortexEnabled;
  vortexInwardBinding.hidden = !params.vortexEnabled;
  vortexUpwardBinding.hidden = !params.vortexEnabled;

  noiseStrengthBinding.hidden = !params.noiseEnabled;
  noiseFrequencyBinding.hidden = !params.noiseEnabled;
  noiseScrollBinding.hidden = !params.noiseEnabled;
  noiseOctavesBinding.hidden = !params.noiseEnabled;
  noiseLacunarityBinding.hidden = !params.noiseEnabled;
  noisePersistenceBinding.hidden = !params.noiseEnabled;
}
vortexEnabledBinding.on("change", () => updateForcesVisibility());
noiseEnabledBinding.on("change", () => updateForcesVisibility());

const velocityOverLifetimeFolder = pane.addFolder({ title: "Velocity Over Lifetime", expanded: false });
const velocityOverLifetimeEnabledBinding = velocityOverLifetimeFolder.addBinding(params, "velocityOverLifetimeEnabled", {
  label: "Enabled",
});
const velocityLinearXBinding = velocityOverLifetimeFolder.addBinding(params, "velocityLinearX", {
  label: "Linear X",
  x: { min: -30, max: 30, step: 0.01 },
  y: { min: -30, max: 30, step: 0.01 },
});
const velocityLinearYBinding = velocityOverLifetimeFolder.addBinding(params, "velocityLinearY", {
  label: "Linear Y",
  x: { min: -30, max: 30, step: 0.01 },
  y: { min: -30, max: 30, step: 0.01 },
});
const velocityLinearZBinding = velocityOverLifetimeFolder.addBinding(params, "velocityLinearZ", {
  label: "Linear Z",
  x: { min: -30, max: 30, step: 0.01 },
  y: { min: -30, max: 30, step: 0.01 },
});

const sizeOverLifetimeFolder = pane.addFolder({ title: "Size Over Lifetime", expanded: false });
const sizeOverLifetimeEnabledBinding = sizeOverLifetimeFolder.addBinding(params, "sizeOverLifetimeEnabled", { label: "Enabled" });
const sizeOverLifetimeBinding = sizeOverLifetimeFolder.addBinding(params, "sizeOverLifetime", {
  label: "Size",
  x: { min: 0, max: 6, step: 0.01 },
  y: { min: 0, max: 6, step: 0.01 },
});
const sizeOverLifetimeBezierBlade = sizeOverLifetimeFolder.addBlade({
  view: "cubicbezier",
  label: "Curve Shape",
  value: params.sizeOverLifetimeBezier,
  picker: "inline",
  expanded: true,
});
(sizeOverLifetimeBezierBlade as unknown as {
  on: (event: string, handler: (ev: { value: unknown }) => void) => void;
}).on("change", (ev) => {
  params.sizeOverLifetimeBezier = normalizeCubicBezierValue(ev.value, params.sizeOverLifetimeBezier);
  applyParamsToPreset();
  refreshDiagnostics();
  updateLifetimeModifierVisibility();
  jsonPane.refresh();
  respawn();
});

const colorOverLifetimeFolder = pane.addFolder({ title: "Color Over Lifetime", expanded: false });
const colorOverLifetimeEnabledBinding = colorOverLifetimeFolder.addBinding(params, "colorOverLifetimeEnabled", { label: "Enabled" });
const lifetimeGradientBinding = colorOverLifetimeFolder.addBinding(params, "lifetimeGradient", { label: "Gradient", view: "gradient" });

const limitVelocityFolder = pane.addFolder({ title: "Limit Velocity Over Lifetime", expanded: false });
const limitVelocityEnabledBinding = limitVelocityFolder.addBinding(params, "limitVelocityEnabled", { label: "Enabled" });
const limitVelocitySpeedBinding = limitVelocityFolder.addBinding(params, "limitVelocitySpeed", {
  label: "Speed",
  x: { min: 0, max: 100, step: 0.01 },
  y: { min: 0, max: 100, step: 0.01 },
});
const limitVelocityDampenBinding = limitVelocityFolder.addBinding(params, "limitVelocityDampen", {
  label: "Dampen",
  min: 0,
  max: 1,
  step: 0.01,
});

const colorBySpeedFolder = pane.addFolder({ title: "Color By Speed", expanded: false });
const colorBySpeedEnabledBinding = colorBySpeedFolder.addBinding(params, "colorBySpeedEnabled", { label: "Enabled" });
const colorBySpeedRangeBinding = colorBySpeedFolder.addBinding(params, "colorBySpeedRange", {
  label: "Speed Range",
  x: { min: 0, max: 100, step: 0.01 },
  y: { min: 0, max: 100, step: 0.01 },
});
const colorBySpeedGradientBinding = colorBySpeedFolder.addBinding(params, "colorBySpeedGradient", { label: "Gradient", view: "gradient" });

const sizeBySpeedFolder = pane.addFolder({ title: "Size By Speed", expanded: false });
const sizeBySpeedEnabledBinding = sizeBySpeedFolder.addBinding(params, "sizeBySpeedEnabled", { label: "Enabled" });
const sizeBySpeedRangeBinding = sizeBySpeedFolder.addBinding(params, "sizeBySpeedRange", {
  label: "Speed Range",
  x: { min: 0, max: 100, step: 0.01 },
  y: { min: 0, max: 100, step: 0.01 },
});
const sizeBySpeedMultiplierBinding = sizeBySpeedFolder.addBinding(params, "sizeBySpeedMultiplier", {
  label: "Size Multiplier",
  x: { min: 0, max: 6, step: 0.01 },
  y: { min: 0, max: 6, step: 0.01 },
});

const rotationBySpeedFolder = pane.addFolder({ title: "Rotation By Speed", expanded: false });
const rotationBySpeedEnabledBinding = rotationBySpeedFolder.addBinding(params, "rotationBySpeedEnabled", { label: "Enabled" });
const rotationBySpeedRangeBinding = rotationBySpeedFolder.addBinding(params, "rotationBySpeedRange", {
  label: "Speed Range",
  x: { min: 0, max: 100, step: 0.01 },
  y: { min: 0, max: 100, step: 0.01 },
});
const rotationBySpeedAngularBinding = rotationBySpeedFolder.addBinding(params, "rotationBySpeedAngular", {
  label: "Angular Velocity",
  x: { min: -20, max: 20, step: 0.01 },
  y: { min: -20, max: 20, step: 0.01 },
});

function updateLifetimeModifierVisibility(): void {
  velocityLinearXBinding.hidden = !params.velocityOverLifetimeEnabled;
  velocityLinearYBinding.hidden = !params.velocityOverLifetimeEnabled;
  velocityLinearZBinding.hidden = !params.velocityOverLifetimeEnabled;

  sizeOverLifetimeBinding.hidden = !params.sizeOverLifetimeEnabled;
  sizeOverLifetimeBezierBlade.hidden = !params.sizeOverLifetimeEnabled;
  lifetimeGradientBinding.hidden = !params.colorOverLifetimeEnabled;

  limitVelocitySpeedBinding.hidden = !params.limitVelocityEnabled;
  limitVelocityDampenBinding.hidden = !params.limitVelocityEnabled;

  colorBySpeedRangeBinding.hidden = !params.colorBySpeedEnabled;
  colorBySpeedGradientBinding.hidden = !params.colorBySpeedEnabled;

  sizeBySpeedRangeBinding.hidden = !params.sizeBySpeedEnabled;
  sizeBySpeedMultiplierBinding.hidden = !params.sizeBySpeedEnabled;

  rotationBySpeedRangeBinding.hidden = !params.rotationBySpeedEnabled;
  rotationBySpeedAngularBinding.hidden = !params.rotationBySpeedEnabled;

  setFolderTitleEnabledState(velocityOverLifetimeFolder, params.velocityOverLifetimeEnabled);
  setFolderTitleEnabledState(sizeOverLifetimeFolder, params.sizeOverLifetimeEnabled);
  setFolderTitleEnabledState(colorOverLifetimeFolder, params.colorOverLifetimeEnabled);
  setFolderTitleEnabledState(limitVelocityFolder, params.limitVelocityEnabled);
  setFolderTitleEnabledState(colorBySpeedFolder, params.colorBySpeedEnabled);
  setFolderTitleEnabledState(sizeBySpeedFolder, params.sizeBySpeedEnabled);
  setFolderTitleEnabledState(rotationBySpeedFolder, params.rotationBySpeedEnabled);
}
velocityOverLifetimeEnabledBinding.on("change", () => updateLifetimeModifierVisibility());
sizeOverLifetimeEnabledBinding.on("change", () => updateLifetimeModifierVisibility());
colorOverLifetimeEnabledBinding.on("change", () => updateLifetimeModifierVisibility());
limitVelocityEnabledBinding.on("change", () => updateLifetimeModifierVisibility());
colorBySpeedEnabledBinding.on("change", () => updateLifetimeModifierVisibility());
sizeBySpeedEnabledBinding.on("change", () => updateLifetimeModifierVisibility());
rotationBySpeedEnabledBinding.on("change", () => updateLifetimeModifierVisibility());

const rendererFolder = pane.addFolder({ title: "Renderer", expanded: false });
const rendererStyleFolder = rendererFolder.addFolder({ title: "Render Style", expanded: false });
const rendererTypeBinding = rendererStyleFolder.addBinding(params, "rendererType", {
  label: "Type",
  options: { billboard: "billboard", stretchedBillboard: "stretchedBillboard" },
});
rendererStyleFolder.addBinding(params, "rendererTexture", {
  label: "Texture",
  options: { softDisc: "softDisc", hardDisc: "hardDisc", spark: "spark" },
});
const rendererStretchFactorBinding = rendererStyleFolder.addBinding(params, "rendererStretchFactor", {
  label: "Stretch Factor",
  min: 0,
  max: 8,
  step: 0.01,
});
const rendererStretchMaxScaleBinding = rendererStyleFolder.addBinding(params, "rendererStretchMaxScale", {
  label: "Stretch Max Scale",
  min: 1,
  max: 20,
  step: 0.01,
});

const rendererCompositingFolder = rendererFolder.addFolder({ title: "Compositing", expanded: false });
rendererCompositingFolder.addBinding(params, "rendererBlendMode", {
  label: "Blend",
  options: { alpha: "alpha", additive: "additive", multiply: "multiply" },
});
rendererCompositingFolder.addBinding(params, "rendererAlign", { label: "Align", options: { camera: "camera", velocity: "velocity" } });
rendererCompositingFolder.addBinding(params, "rendererSorting", {
  label: "Sorting (CPU only)",
  options: { none: "none", distance: "distance", youngestFirst: "youngestFirst", oldestFirst: "oldestFirst" },
});

const rendererDepthFolder = rendererFolder.addFolder({ title: "Depth", expanded: false });
rendererDepthFolder.addBinding(params, "rendererDepthWrite", { label: "Depth Write" });
rendererDepthFolder.addBinding(params, "rendererDepthTest", { label: "Depth Test" });
const rendererSoftParticlesBinding = rendererDepthFolder.addBinding(params, "rendererSoftParticles", { label: "Soft Particles" });
const rendererSoftnessBinding = rendererDepthFolder.addBinding(params, "rendererSoftness", {
  label: "Softness",
  min: 0.01,
  max: 8,
  step: 0.01,
});

const rendererAlphaFolder = rendererFolder.addFolder({ title: "Texture Processing", expanded: false });
const rendererAlphaEnabledBinding = rendererAlphaFolder.addBinding(params, "rendererAlphaFromLuminanceEnabled", {
  label: "Alpha From Luminance",
});
const rendererAlphaBlackCutoffBinding = rendererAlphaFolder.addBinding(params, "rendererAlphaFromLuminanceBlackCutoff", {
  label: "Black Cutoff",
  min: 0,
  max: 255,
  step: 1,
});

const rendererTextureSheetFolder = rendererFolder.addFolder({ title: "Texture Sheet", expanded: false });
const rendererTextureSheetEnabledBinding = rendererTextureSheetFolder.addBinding(params, "rendererTextureSheetEnabled", {
  label: "Enabled",
});
const rendererTextureSheetTextureNameBinding = rendererTextureSheetFolder.addBinding(params, "rendererTextureSheetTextureName", {
  label: "Sheet",
  readonly: true,
});
const rendererTextureSheetColumnsBinding = rendererTextureSheetFolder.addBinding(params, "rendererTextureSheetColumns", {
  label: "Columns",
  min: 1,
  max: 16,
  step: 1,
});
const rendererTextureSheetRowsBinding = rendererTextureSheetFolder.addBinding(params, "rendererTextureSheetRows", {
  label: "Rows",
  min: 1,
  max: 16,
  step: 1,
});
const rendererTextureSheetModeBinding = rendererTextureSheetFolder.addBinding(params, "rendererTextureSheetAnimationMode", {
  label: "Animation",
  options: {
    static: "static",
    randomStart: "randomStart",
    overLifetime: "overLifetime",
    randomStartOverLifetime: "randomStartOverLifetime",
  },
});
const clearRendererTextureSheetButton = rendererTextureSheetFolder.addButton({ title: "Clear Sheet Texture" });
clearRendererTextureSheetButton.on("click", () => {
  customRendererTexture = undefined;
  params.rendererTextureSheetTextureName = "Built-in";
  applyParamsToPreset();
  refreshDiagnostics();
  updateRendererVisibility();
  jsonPane.refresh();
  respawn();
});

async function loadRendererTextureSheetFromFile(file: File): Promise<void> {
  const objectUrl = URL.createObjectURL(file);
  const texture = await new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      objectUrl,
      (loaded) => resolve(loaded),
      undefined,
      (err) => reject(err)
    );
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  customRendererTexture = texture;
  params.rendererTextureSheetTextureName = file.name;
  if (customRendererTextureObjectUrl) URL.revokeObjectURL(customRendererTextureObjectUrl);
  customRendererTextureObjectUrl = objectUrl;
  applyParamsToPreset();
  refreshDiagnostics();
  updateRendererVisibility();
  jsonPane.refresh();
  respawn();
}

function updateRendererSheetPreview(): void {
  if (!rendererSheetPreviewCanvas) return;
  const ctx = rendererSheetPreviewCanvas.getContext("2d");
  if (!ctx) return;
  const width = rendererSheetPreviewCanvas.width;
  const height = rendererSheetPreviewCanvas.height;
  ctx.clearRect(0, 0, width, height);

  const image = customRendererTexture?.image;
  if (image && typeof image === "object") {
    const source = image as CanvasImageSource & { width?: number; height?: number };
    const sourceW = source.width ?? width;
    const sourceH = source.height ?? height;
    if (sourceW > 0 && sourceH > 0) {
      const scale = Math.min(width / sourceW, height / sourceH);
      const drawW = Math.max(1, Math.floor(sourceW * scale));
      const drawH = Math.max(1, Math.floor(sourceH * scale));
      const dx = Math.floor((width - drawW) * 0.5);
      const dy = Math.floor((height - drawH) * 0.5);
      ctx.drawImage(source, dx, dy, drawW, drawH);
      return;
    }
  }

  ctx.fillStyle = "#0f1218";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let x = 0; x <= width; x += 16) {
    ctx.fillRect(x, 0, 1, height);
  }
  for (let y = 0; y <= height; y += 16) {
    ctx.fillRect(0, y, width, 1);
  }
}

const rendererTextureSheetContent = (rendererTextureSheetFolder as { element?: HTMLElement }).element?.querySelector<HTMLElement>(".tp-fldv_c");
if (rendererTextureSheetContent) {
  const previewLabel = document.createElement("div");
  previewLabel.className = "renderer-sheet-preview-label";
  previewLabel.textContent = "Sheet Preview";
  const previewCanvas = document.createElement("canvas");
  previewCanvas.className = "renderer-sheet-preview-canvas";
  previewCanvas.width = 112;
  previewCanvas.height = 112;
  rendererSheetPreviewCanvas = previewCanvas;

  const dropzone = document.createElement("div");
  dropzone.className = "renderer-sheet-dropzone";
  dropzone.textContent = "Drop texture sheet here or click to browse";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    dropzone.classList.add("is-drag-over");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-drag-over"));
  dropzone.addEventListener("drop", (ev) => {
    ev.preventDefault();
    dropzone.classList.remove("is-drag-over");
    const file = ev.dataTransfer?.files?.[0];
    if (!file) return;
    void loadRendererTextureSheetFromFile(file).catch((err) => {
      window.alert(`Could not load image: ${(err as Error).message}`);
    });
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    void loadRendererTextureSheetFromFile(file).catch((err) => {
      window.alert(`Could not load image: ${(err as Error).message}`);
    });
    fileInput.value = "";
  });
  rendererTextureSheetContent.appendChild(previewLabel);
  rendererTextureSheetContent.appendChild(previewCanvas);
  rendererTextureSheetContent.appendChild(dropzone);
  rendererTextureSheetContent.appendChild(fileInput);
}

const dispersalFolder = pane.addFolder({ title: "Dispersal", expanded: false });
const dispersalEnabledBinding = dispersalFolder.addBinding(params, "dispersalEnabled", { label: "Enabled" });
const dispersalTextureNameBinding = dispersalFolder.addBinding(params, "dispersalTextureName", { label: "Texture", readonly: true });
const dispersalStrengthBinding = dispersalFolder.addBinding(params, "dispersalStrength", {
  label: "Strength",
  min: 0,
  max: 1,
  step: 0.01,
});
const dispersalAmountBinding = dispersalFolder.addBinding(params, "dispersalAmount", {
  label: "Amount",
  x: { min: 0, max: 1, step: 0.01 },
  y: { min: 0, max: 1, step: 0.01 },
});
const dispersalStartAtBinding = dispersalFolder.addBinding(params, "dispersalStartAt", {
  label: "Start At",
  min: 0,
  max: 1,
  step: 0.01,
});
const dispersalNoiseScaleBinding = dispersalFolder.addBinding(params, "dispersalNoiseScale", {
  label: "Noise Scale",
  min: 0.01,
  max: 20,
  step: 0.01,
});
const dispersalEdgeSoftnessBinding = dispersalFolder.addBinding(params, "dispersalEdgeSoftness", {
  label: "Edge Softness",
  min: 0.001,
  max: 2,
  step: 0.001,
});
const dispersalScrollBinding = dispersalFolder.addBinding(params, "dispersalScroll", {
  label: "Scroll",
  x: { min: -2, max: 2, step: 0.001 },
  y: { min: -2, max: 2, step: 0.001 },
});
const clearDispersalTextureButton = dispersalFolder.addButton({ title: "Clear Texture" });
clearDispersalTextureButton.on("click", () => {
  customDispersalTexture = undefined;
  params.dispersalTextureName = "Built-in noise";
  applyParamsToPreset();
  refreshDiagnostics();
  updateDispersalVisibility();
  jsonPane.refresh();
  respawn();
});

function dispersalHash2D(x: number, y: number): number {
  return (Math.sin(x * 127.1 + y * 311.7) * 43758.5453123) % 1;
}

function dispersalValueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const n00 = dispersalHash2D(ix, iy);
  const n10 = dispersalHash2D(ix + 1, iy);
  const n01 = dispersalHash2D(ix, iy + 1);
  const n11 = dispersalHash2D(ix + 1, iy + 1);
  const nx0 = THREE.MathUtils.lerp(n00, n10, ux);
  const nx1 = THREE.MathUtils.lerp(n01, n11, ux);
  return THREE.MathUtils.clamp(THREE.MathUtils.lerp(nx0, nx1, uy), 0, 1);
}

function updateDispersalPreview(): void {
  if (!dispersalPreviewCanvas) return;
  const ctx = dispersalPreviewCanvas.getContext("2d");
  if (!ctx) return;
  const width = dispersalPreviewCanvas.width;
  const height = dispersalPreviewCanvas.height;

  ctx.clearRect(0, 0, width, height);
  const customImage = customDispersalTexture?.image;
  if (customImage && typeof customImage === "object") {
    const source = customImage as CanvasImageSource & { width?: number; height?: number };
    const sourceW = source.width ?? width;
    const sourceH = source.height ?? height;
    if (sourceW > 0 && sourceH > 0) {
      const scale = Math.min(width / sourceW, height / sourceH);
      const drawW = Math.max(1, Math.floor(sourceW * scale));
      const drawH = Math.max(1, Math.floor(sourceH * scale));
      const dx = Math.floor((width - drawW) * 0.5);
      const dy = Math.floor((height - drawH) * 0.5);
      ctx.drawImage(source, dx, dy, drawW, drawH);
      return;
    }
  }

  const image = ctx.createImageData(width, height);
  const data = image.data;
  const scale = Math.max(0.01, params.dispersalNoiseScale);
  const scrollX = params.dispersalScroll.x * 4;
  const scrollY = params.dispersalScroll.y * 4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x / Math.max(1, width - 1)) * scale + scrollX;
      const v = (y / Math.max(1, height - 1)) * scale + scrollY;
      const n = dispersalValueNoise2D(u, v);
      const c = Math.round(n * 255);
      const i = (y * width + x) * 4;
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

async function loadDispersalTextureFromFile(file: File): Promise<void> {
  const objectUrl = URL.createObjectURL(file);
  const texture = await new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      objectUrl,
      (loaded) => resolve(loaded),
      undefined,
      (err) => reject(err)
    );
  });
  // Dispersal maps are scalar masks; sample as data (not display color).
  texture.colorSpace = THREE.NoColorSpace;
  // Imported maps are sampled centered per particle; clamp avoids tile seams.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  customDispersalTexture = texture;
  params.dispersalTextureName = file.name;
  if (customDispersalTextureObjectUrl) URL.revokeObjectURL(customDispersalTextureObjectUrl);
  customDispersalTextureObjectUrl = objectUrl;
  applyParamsToPreset();
  refreshDiagnostics();
  updateDispersalVisibility();
  updateDispersalPreview();
  jsonPane.refresh();
  respawn();
}

const dispersalContentElement = (dispersalFolder as { element?: HTMLElement }).element?.querySelector<HTMLElement>(".tp-fldv_c");
if (dispersalContentElement) {
  const previewLabel = document.createElement("div");
  previewLabel.className = "dispersal-preview-label";
  previewLabel.textContent = "Mask Preview";
  const previewCanvas = document.createElement("canvas");
  previewCanvas.className = "dispersal-preview-canvas";
  previewCanvas.width = 112;
  previewCanvas.height = 112;
  dispersalPreviewCanvas = previewCanvas;
  const dropzone = document.createElement("div");
  dropzone.className = "dispersal-dropzone";
  dropzone.textContent = "Drop image here for Dispersal texture or click to browse";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    dropzone.classList.add("is-drag-over");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-drag-over"));
  dropzone.addEventListener("drop", (ev) => {
    ev.preventDefault();
    dropzone.classList.remove("is-drag-over");
    const file = ev.dataTransfer?.files?.[0];
    if (!file) return;
    void loadDispersalTextureFromFile(file).catch((err) => {
      window.alert(`Could not load image: ${(err as Error).message}`);
    });
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    void loadDispersalTextureFromFile(file).catch((err) => {
      window.alert(`Could not load image: ${(err as Error).message}`);
    });
    fileInput.value = "";
  });
  dispersalContentElement.appendChild(previewLabel);
  dispersalContentElement.appendChild(previewCanvas);
  dispersalContentElement.appendChild(dropzone);
  dispersalContentElement.appendChild(fileInput);
}

function updateDispersalVisibility(): void {
  const dispersalDropzone = (dispersalFolder as { element?: HTMLElement }).element?.querySelector<HTMLElement>(".dispersal-dropzone");
  if (dispersalDropzone) dispersalDropzone.style.display = params.dispersalEnabled ? "" : "none";
  dispersalTextureNameBinding.hidden = !params.dispersalEnabled;
  dispersalStrengthBinding.hidden = !params.dispersalEnabled;
  dispersalAmountBinding.hidden = !params.dispersalEnabled;
  dispersalStartAtBinding.hidden = !params.dispersalEnabled;
  dispersalNoiseScaleBinding.hidden = !params.dispersalEnabled;
  dispersalEdgeSoftnessBinding.hidden = !params.dispersalEnabled;
  dispersalScrollBinding.hidden = !params.dispersalEnabled;
  setFolderTitleEnabledState(dispersalFolder, params.dispersalEnabled);
  updateDispersalPreview();
}
dispersalEnabledBinding.on("change", () => updateDispersalVisibility());

function updateRendererVisibility(): void {
  const isStretched = params.rendererType === "stretchedBillboard";
  rendererStretchFactorBinding.hidden = !isStretched;
  rendererStretchMaxScaleBinding.hidden = !isStretched;
  rendererSoftnessBinding.hidden = !params.rendererSoftParticles;
  rendererAlphaBlackCutoffBinding.hidden = !params.rendererAlphaFromLuminanceEnabled;
  rendererTextureSheetColumnsBinding.hidden = !params.rendererTextureSheetEnabled;
  rendererTextureSheetRowsBinding.hidden = !params.rendererTextureSheetEnabled;
  rendererTextureSheetModeBinding.hidden = !params.rendererTextureSheetEnabled;
  rendererTextureSheetTextureNameBinding.hidden = !params.rendererTextureSheetEnabled;
  clearRendererTextureSheetButton.hidden = !params.rendererTextureSheetEnabled;
  const sheetDropzone = (rendererTextureSheetFolder as { element?: HTMLElement }).element?.querySelector<HTMLElement>(".renderer-sheet-dropzone");
  if (sheetDropzone) sheetDropzone.style.display = params.rendererTextureSheetEnabled ? "" : "none";
  const sheetPreviewLabel = (rendererTextureSheetFolder as { element?: HTMLElement }).element?.querySelector<HTMLElement>(".renderer-sheet-preview-label");
  if (sheetPreviewLabel) sheetPreviewLabel.style.display = params.rendererTextureSheetEnabled ? "" : "none";
  const sheetPreviewCanvas = (rendererTextureSheetFolder as { element?: HTMLElement }).element?.querySelector<HTMLElement>(".renderer-sheet-preview-canvas");
  if (sheetPreviewCanvas) sheetPreviewCanvas.style.display = params.rendererTextureSheetEnabled ? "" : "none";
  updateRendererSheetPreview();

  setFolderTitleEnabledState(rendererDepthFolder, params.rendererSoftParticles);
  setFolderTitleEnabledState(rendererAlphaFolder, params.rendererAlphaFromLuminanceEnabled);
  setFolderTitleEnabledState(rendererTextureSheetFolder, params.rendererTextureSheetEnabled);
}
rendererTypeBinding.on("change", () => updateRendererVisibility());
rendererSoftParticlesBinding.on("change", () => updateRendererVisibility());
rendererAlphaEnabledBinding.on("change", () => updateRendererVisibility());
rendererTextureSheetEnabledBinding.on("change", () => updateRendererVisibility());

const actionsFolder = pane.addFolder({ title: "Actions", expanded: false });
actionsFolder.addButton({ title: "Reset to baseline" }).on("click", () => {
  workingPreset = clonePreset(baselinePreset);
  syncParamsFromPreset();
  updateRendererVisibility();
  updateDispersalVisibility();
  refreshDiagnostics();
  refreshPaneSafely();
  respawn();
});
actionsFolder.addButton({ title: "Restart effect" }).on("click", () => activeSystem?.restart());
actionsFolder.addButton({ title: "Copy JSON" }).on("click", async () => {
  await navigator.clipboard.writeText(stringifyPreset(workingPreset, true));
});

const jsonPane = new Pane({ title: "Preset JSON", expanded: true, container: jsonPaneHost });
const jsonContent = jsonPane.addBinding(params, "rawJson", {
  label: "Preset",
  multiline: true,
  rows: 24,
});
jsonContent.on("change", () => {
  if (isRefreshingPane) return;
});
jsonPane.addButton({ title: "Apply JSON" }).on("click", () => {
  try {
    const rawInput = jsonPaneHost.querySelector<HTMLTextAreaElement>("textarea")?.value ?? params.rawJson;
    params.rawJson = rawInput;

    // 1) parse + clean the input into a usable preset
    const parsed = parsePresetInput(rawInput);
    const extracted = extractPresetFromJsonValue(parsed);
    if (!extracted) {
      throw new Error("Could not find a valid ParticlePreset shape in the pasted JSON.");
    }
    const sanitized = sanitizeImportedPreset(extracted);
    workingPreset = sanitized.preset;

    // 2) sync UI model from imported preset
    syncParamsFromPreset();

    // 3) refresh all dependent visibility/sections, then refresh panes
    updateEmissionVisibility();
    updateEmitterVisibility();
    updateStartVisibility();
    updateForcesVisibility();
    updateLifetimeModifierVisibility();
    updateRendererVisibility();
    updateDispersalVisibility();
    refreshDiagnostics();
    refreshPaneSafely();
    jsonPane.refresh();
    diagnosticsPane.refresh();

    // 4) restart effect from imported preset
    respawn();
    if (sanitized.warnings.length > 0) {
      window.alert(`Imported with adjustments:\n- ${sanitized.warnings.join("\n- ")}`);
    }
  } catch (err) {
    window.alert(`Invalid JSON: ${(err as Error).message}`);
  }
});

const diagnosticsPane = new Pane({ title: "Diagnostics", expanded: true, container: diagnosticsPaneHost });
diagnosticsPane.registerPlugin(EssentialsPlugin);
const fpsGraph = (diagnosticsPane as unknown as {
  addBlade: (params: Record<string, unknown>) => { begin: () => void; end: () => void };
}).addBlade({
  view: "fpsgraph",
  label: "FPS",
  rows: 2,
});
const runtimeFolder = diagnosticsPane.addFolder({ title: "Runtime Stats", expanded: false });
runtimeFolder.addBinding(runtimeStats, "systems", { readonly: true, label: "Systems" });
runtimeFolder.addBinding(runtimeStats, "cpuSystems", { readonly: true, label: "CPU Systems" });
runtimeFolder.addBinding(runtimeStats, "gpuSystems", { readonly: true, label: "GPU Systems" });
runtimeFolder.addBinding(runtimeStats, "aliveTotal", { readonly: true, label: "Alive Total" });
runtimeFolder.addBinding(runtimeStats, "maxTotal", { readonly: true, label: "Max Total" });
runtimeFolder.addBinding(runtimeStats, "busiest", { readonly: true, label: "Busiest" });
runtimeFolder.addBinding(runtimeStats, "busiestAlive", { readonly: true, label: "Busiest Alive" });
const validationFolder = diagnosticsPane.addFolder({ title: "Validation", expanded: false });
validationFolder.addBinding(params, "diagnostics", { label: "Diagnostics", multiline: true, rows: 4, readonly: true });

const debugPane = new Pane({ title: "Debug", expanded: true, container: debugPaneHost });
debugPane.addBinding(globalDebugParams, "enabled", { label: "Debug Gizmos" }).on("change", () => {
  if (!wisp.particles) return;
  wisp.particles.setDebug(globalDebugParams.enabled);
});
const cameraFolder = debugPane.addFolder({ title: "Camera", expanded: true });
cameraFolder.addBinding(globalDebugParams, "autoOrbit", { label: "Auto orbit" });
cameraFolder.addBinding(globalDebugParams, "orbitSpeedDegPerSec", {
  label: "Speed (deg/s)",
  min: -180,
  max: 180,
  step: 1,
});
const debugPlaybackControls = document.createElement("div");
debugPlaybackControls.className = "debug-playback-grid";
const playButton = document.createElement("button");
playButton.type = "button";
playButton.textContent = "Play";
const pauseButton = document.createElement("button");
pauseButton.type = "button";
pauseButton.textContent = "Pause";
const resetButton = document.createElement("button");
resetButton.type = "button";
resetButton.textContent = "Reset";
debugPlaybackControls.append(playButton, pauseButton, resetButton);
((debugPane as unknown as { element?: HTMLElement }).element ?? debugPaneHost).appendChild(debugPlaybackControls);

function updateDebugPlaybackButtons(): void {
  playButton.classList.toggle("is-active", debugPlaybackMode === "play");
  pauseButton.classList.toggle("is-active", debugPlaybackMode === "pause");
}

function seekActiveSystemTo(targetTime: number): void {
  if (!activeSystem) return;
  const duration = Math.max(0.01, workingPreset.duration ?? 1);
  const clamped = THREE.MathUtils.clamp(targetTime, 0, duration);
  activeSystem.restart();
  if (clamped <= 0) {
    activeSystem.pause();
    globalDebugParams.playbackTime = 0;
    return;
  }
  let remaining = clamped;
  const step = 1 / 120;
  while (remaining > 0) {
    const dtSeek = Math.min(step, remaining);
    activeSystem.update(dtSeek, camera);
    remaining -= dtSeek;
  }
  activeSystem.pause();
  globalDebugParams.playbackTime = clamped;
}

function setDebugPlaybackMode(mode: "play" | "pause"): void {
  debugPlaybackMode = mode;
  if (activeSystem) {
    if (mode === "play") activeSystem.play();
    if (mode === "pause") activeSystem.pause();
  }
  updateDebugPlaybackButtons();
}

playButton.addEventListener("click", () => setDebugPlaybackMode("play"));
pauseButton.addEventListener("click", () => setDebugPlaybackMode("pause"));
resetButton.addEventListener("click", () => {
  if (!activeSystem) return;
  activeSystem.restart();
  if (debugPlaybackMode !== "play") activeSystem.pause();
  globalDebugParams.playbackTime = 0;
});
updateDebugPlaybackButtons();

function rebuildDebugPlaybackBinding(): void {
  if (debugPlaybackBinding?.dispose) debugPlaybackBinding.dispose();
  debugPlaybackBinding = debugPane.addBinding(globalDebugParams, "playbackTime", {
    label: "Playback (s)",
    min: 0,
    max: debugPlaybackDuration,
  }) as unknown as { dispose?: () => void; label?: string };
  debugPlaybackBinding.on?.("change", (ev) => {
    if (debugPlaybackMode !== "pause") return;
    seekActiveSystemTo(ev.value);
  });
}
rebuildDebugPlaybackBinding();

pane.on("change", () => {
  if (isRefreshingPane) return;
  const beforePresetJson = stringifyPreset(workingPreset);
  applyParamsToPreset();
  const didPresetChange = beforePresetJson !== stringifyPreset(workingPreset);
  refreshDiagnostics();
  updateEmissionVisibility();
  updateEmitterVisibility();
  updateStartVisibility();
  updateForcesVisibility();
  updateLifetimeModifierVisibility();
  updateRendererVisibility();
  updateDispersalVisibility();
  jsonPane.refresh();
  if (didPresetChange) {
    respawn();
    if (debugPlaybackMode === "pause") activeSystem?.pause();
  }
});

function resize(): void {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  sceneDepthTarget.dispose();
  sceneDepthTarget = createSceneDepthTarget();
  syncSoftParticleDepthTexture();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const timer = new THREE.Timer();
function tick(): void {
  fpsGraph.begin();
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.033);
  orbitControls.autoRotate = globalDebugParams.autoOrbit;
  orbitControls.autoRotateSpeed = globalDebugParams.orbitSpeedDegPerSec / 6;
  orbitControls.update();
  wisp.update(dt, camera);
  renderSceneDepthWithoutParticles();
  syncSoftParticleDepthTexture();
  renderer.render(scene, camera);
  fpsGraph.end();

  runtimeStatsRefreshElapsed += dt;
  if (runtimeStatsRefreshElapsed >= 0.2) {
    runtimeStatsRefreshElapsed = 0;
    refreshRuntimeStats();
  }

  const duration = Math.max(0.01, workingPreset.duration ?? 1);
  if (Math.abs(duration - debugPlaybackDuration) > 1e-6) {
    debugPlaybackDuration = duration;
    rebuildDebugPlaybackBinding();
  }
  if (activeSystem) {
    const elapsed = activeSystem.elapsed;
    globalDebugParams.playbackTime = workingPreset.loop ? elapsed % duration : Math.min(elapsed, duration);
  } else {
    globalDebugParams.playbackTime = 0;
  }
  debugPane.refresh();

  requestAnimationFrame(tick);
}

syncParamsFromPreset();
refreshDiagnostics();
updateEmissionVisibility();
updateEmitterVisibility();
updateStartVisibility();
updateForcesVisibility();
updateLifetimeModifierVisibility();
updateRendererVisibility();
updateDispersalVisibility();
refreshPaneSafely();
jsonPane.refresh();
diagnosticsPane.refresh();
respawn();
refreshRuntimeStats();
tick();
