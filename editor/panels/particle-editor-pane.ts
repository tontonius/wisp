import * as THREE from "three";
import { Pane } from "tweakpane";
import * as EssentialsPlugin from "@tweakpane/plugin-essentials";
import { tweakpaneGradientPluginBundle } from "../../demo/tweakpane-gradient-plugin/index.js";
import { normalizeCubicBezierValue } from "../lib/curves.js";
import { clonePreset } from "../lib/preset-utils.js";
import { stringifyPreset } from "../lib/preset-io.js";
import { setFolderTitleEnabledState } from "../lib/tweakpane-helpers.js";
import { dispersalValueNoise2D } from "../lib/dispersal-noise.js";
import { buildLayersFromImportEffectsPayload, parseImportEffectsPayload } from "../state/import.js";
import type { PanelRuntime } from "../panel-runtime.js";

export function installParticleEditorPane(rt: PanelRuntime, host: HTMLDivElement): void {
const pane = new Pane({ title: "Particle Editor", expanded: true, container: host });
pane.registerPlugin(EssentialsPlugin);
pane.registerPlugin(tweakpaneGradientPluginBundle);

const systemFolder = pane.addFolder({ title: "Particle System", expanded: false });
systemFolder.addBinding(rt.params, "simulation", { label: "Simulation", options: { auto: "auto", cpu: "cpu", gpu: "gpu" } });
systemFolder.addBinding(rt.params, "simulationSpace", { label: "Simulation Space", options: { local: "local", world: "world" } });
systemFolder.addBinding(rt.params, "maxParticles", { label: "Max Particles", min: 1, max: 50000, step: 1 });
systemFolder.addBinding(rt.params, "duration", { label: "Duration", min: 0.01, max: 60, step: 0.01 });
systemFolder.addBinding(rt.params, "loop", { label: "Loop" });
systemFolder.addBinding(rt.params, "prewarm", { label: "Prewarm" });

const emissionFolder = pane.addFolder({ title: "Emission", expanded: false });
const emissionModeBinding = emissionFolder.addBinding(rt.params, "emissionMode", {
  label: "Mode",
  options: { rate: "rate", burst: "burst" },
});
const rateBinding = emissionFolder.addBinding(rt.params, "rateOverTime", { label: "Rate Over Time", min: 0, max: 5000, step: 1 });
const burstTimeBinding = emissionFolder.addBinding(rt.params, "burstTime", { label: "Burst Time", min: 0, max: 60, step: 0.01 });
const burstCountBinding = emissionFolder.addBinding(rt.params, "burstCount", {
  label: "Burst count",
  x: { min: 0, max: 10000, step: 1 },
  y: { min: 0, max: 10000, step: 1 },
});
const burstProbabilityBinding = emissionFolder.addBinding(rt.params, "burstProbability", {
  label: "Burst prob",
  min: 0,
  max: 1,
  step: 0.01,
});

function updateEmissionVisibility(): void {
  const isRate = rt.params.emissionMode === "rate";
  rateBinding.hidden = !isRate;
  burstTimeBinding.hidden = isRate;
  burstCountBinding.hidden = isRate;
  burstProbabilityBinding.hidden = isRate;
}
emissionModeBinding.on("change", () => updateEmissionVisibility());

const emitterFolder = pane.addFolder({ title: "Emitter", expanded: false });
const emitterTypeBinding = emitterFolder.addBinding(rt.params, "emitterType", {
  label: "Type",
  options: { point: "point", sphere: "sphere", hemisphere: "hemisphere", cone: "cone", box: "box" },
});
const emitterEmitFromBinding = emitterFolder.addBinding(rt.params, "emitterEmitFrom", {
  label: "Emit From",
  options: { volume: "volume", shell: "shell" },
});
const emitterRadiusBinding = emitterFolder.addBinding(rt.params, "emitterRadius", {
  label: "Radius",
  min: 0,
  max: 10,
  step: 0.01,
});
const emitterAngleBinding = emitterFolder.addBinding(rt.params, "emitterAngle", { label: "Cone angle", min: 0, max: 89, step: 0.1 });
const emitterLengthBinding = emitterFolder.addBinding(rt.params, "emitterLength", { label: "Cone length", min: 0, max: 20, step: 0.01 });
const emitterBoxSizeBinding = emitterFolder.addBinding(rt.params, "emitterBoxSize", {
  label: "Box size",
  x: { min: 0, max: 20, step: 0.01 },
  y: { min: 0, max: 20, step: 0.01 },
  z: { min: 0, max: 20, step: 0.01 },
});

function updateEmitterVisibility(): void {
  const type = rt.params.emitterType;
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
startFolder.addBinding(rt.params, "lifetimeRange", {
  label: "Lifetime",
  x: { min: 0.01, max: 30, step: 0.01 },
  y: { min: 0.01, max: 30, step: 0.01 },
});
startFolder.addBinding(rt.params, "speedRange", {
  label: "Speed",
  x: { min: -50, max: 100, step: 0.01 },
  y: { min: -50, max: 100, step: 0.01 },
});
startFolder.addBinding(rt.params, "sizeRange", {
  label: "Size",
  x: { min: 0, max: 10, step: 0.01 },
  y: { min: 0, max: 10, step: 0.01 },
});
startFolder.addBinding(rt.params, "opacityRange", {
  label: "Opacity",
  x: { min: 0, max: 1, step: 0.01 },
  y: { min: 0, max: 1, step: 0.01 },
});
startFolder.addBinding(rt.params, "startRotationRange", {
  label: "Rotation (rad)",
  x: { min: -6.283, max: 6.283, step: 0.001 },
  y: { min: -6.283, max: 6.283, step: 0.001 },
});
startFolder.addBinding(rt.params, "startAngularVelocityRange", {
  label: "Angular Vel (rad/s)",
  x: { min: -20, max: 20, step: 0.01 },
  y: { min: -20, max: 20, step: 0.01 },
});
startFolder.addBinding(rt.params, "startVelocityMin", {
  label: "Velocity Min",
  x: { min: -50, max: 50, step: 0.01 },
  y: { min: -50, max: 50, step: 0.01 },
  z: { min: -50, max: 50, step: 0.01 },
});
startFolder.addBinding(rt.params, "startVelocityMax", {
  label: "Velocity Max",
  x: { min: -50, max: 50, step: 0.01 },
  y: { min: -50, max: 50, step: 0.01 },
  z: { min: -50, max: 50, step: 0.01 },
});
const startColorModeBinding = startFolder.addBinding(rt.params, "startColorMode", {
  label: "Color Mode",
  options: { single: "single", range: "range" },
});
const startColorABinding = startFolder.addBinding(rt.params, "startColorA", { label: "Color A" });
const startColorBBinding = startFolder.addBinding(rt.params, "startColorB", { label: "Color B" });

function updateStartVisibility(): void {
  const isRange = rt.params.startColorMode === "range";
  startColorBBinding.hidden = !isRange;
}
startColorModeBinding.on("change", () => updateStartVisibility());

const forcesFolder = pane.addFolder({ title: "Forces", expanded: false });
forcesFolder.addBinding(rt.params, "drag", { label: "Drag", min: 0, max: 20, step: 0.01 });
forcesFolder.addBinding(rt.params, "acceleration", {
  label: "Acceleration",
  x: { min: -50, max: 50, step: 0.01 },
  y: { min: -50, max: 50, step: 0.01 },
  z: { min: -50, max: 50, step: 0.01 },
});
const vortexEnabledBinding = forcesFolder.addBinding(rt.params, "vortexEnabled", { label: "Vortex Enabled" });
const vortexCenterBinding = forcesFolder.addBinding(rt.params, "vortexCenter", {
  label: "Vortex center",
  x: { min: -20, max: 20, step: 0.01 },
  y: { min: -20, max: 20, step: 0.01 },
  z: { min: -20, max: 20, step: 0.01 },
});
const vortexAxisBinding = forcesFolder.addBinding(rt.params, "vortexAxis", {
  label: "Vortex axis",
  x: { min: -1, max: 1, step: 0.01 },
  y: { min: -1, max: 1, step: 0.01 },
  z: { min: -1, max: 1, step: 0.01 },
});
const vortexOrbitalBinding = forcesFolder.addBinding(rt.params, "vortexOrbitalSpeed", { label: "Vortex Orbital Speed", min: -50, max: 50, step: 0.01 });
const vortexInwardBinding = forcesFolder.addBinding(rt.params, "vortexInward", { label: "Vortex Inward", min: -50, max: 50, step: 0.01 });
const vortexUpwardBinding = forcesFolder.addBinding(rt.params, "vortexUpward", { label: "Vortex Upward", min: -50, max: 50, step: 0.01 });

const noiseEnabledBinding = forcesFolder.addBinding(rt.params, "noiseEnabled", { label: "Noise Enabled" });
const noiseStrengthBinding = forcesFolder.addBinding(rt.params, "noiseStrength", { label: "Noise Strength", min: 0, max: 20, step: 0.01 });
const noiseFrequencyBinding = forcesFolder.addBinding(rt.params, "noiseFrequency", { label: "Noise Frequency", min: 0.01, max: 30, step: 0.01 });
const noiseScrollBinding = forcesFolder.addBinding(rt.params, "noiseScroll", {
  label: "Noise scroll",
  x: { min: -20, max: 20, step: 0.01 },
  y: { min: -20, max: 20, step: 0.01 },
  z: { min: -20, max: 20, step: 0.01 },
});
const noiseOctavesBinding = forcesFolder.addBinding(rt.params, "noiseOctaves", { label: "Noise Octaves", min: 1, max: 8, step: 1 });
const noiseLacunarityBinding = forcesFolder.addBinding(rt.params, "noiseLacunarity", { label: "Noise Lacunarity", min: 0.01, max: 8, step: 0.01 });
const noisePersistenceBinding = forcesFolder.addBinding(rt.params, "noisePersistence", { label: "Noise Persistence", min: 0, max: 2, step: 0.01 });

function updateForcesVisibility(): void {
  vortexCenterBinding.hidden = !rt.params.vortexEnabled;
  vortexAxisBinding.hidden = !rt.params.vortexEnabled;
  vortexOrbitalBinding.hidden = !rt.params.vortexEnabled;
  vortexInwardBinding.hidden = !rt.params.vortexEnabled;
  vortexUpwardBinding.hidden = !rt.params.vortexEnabled;

  noiseStrengthBinding.hidden = !rt.params.noiseEnabled;
  noiseFrequencyBinding.hidden = !rt.params.noiseEnabled;
  noiseScrollBinding.hidden = !rt.params.noiseEnabled;
  noiseOctavesBinding.hidden = !rt.params.noiseEnabled;
  noiseLacunarityBinding.hidden = !rt.params.noiseEnabled;
  noisePersistenceBinding.hidden = !rt.params.noiseEnabled;
}
vortexEnabledBinding.on("change", () => updateForcesVisibility());
noiseEnabledBinding.on("change", () => updateForcesVisibility());

const velocityOverLifetimeFolder = pane.addFolder({ title: "Velocity Over Lifetime", expanded: false });
const velocityOverLifetimeEnabledBinding = velocityOverLifetimeFolder.addBinding(rt.params, "velocityOverLifetimeEnabled", {
  label: "Enabled",
});
const velocityLinearXBinding = velocityOverLifetimeFolder.addBinding(rt.params, "velocityLinearX", {
  label: "Linear X",
  x: { min: -30, max: 30, step: 0.01 },
  y: { min: -30, max: 30, step: 0.01 },
});
const velocityLinearYBinding = velocityOverLifetimeFolder.addBinding(rt.params, "velocityLinearY", {
  label: "Linear Y",
  x: { min: -30, max: 30, step: 0.01 },
  y: { min: -30, max: 30, step: 0.01 },
});
const velocityLinearZBinding = velocityOverLifetimeFolder.addBinding(rt.params, "velocityLinearZ", {
  label: "Linear Z",
  x: { min: -30, max: 30, step: 0.01 },
  y: { min: -30, max: 30, step: 0.01 },
});

const sizeOverLifetimeFolder = pane.addFolder({ title: "Size Over Lifetime", expanded: false });
const sizeOverLifetimeEnabledBinding = sizeOverLifetimeFolder.addBinding(rt.params, "sizeOverLifetimeEnabled", { label: "Enabled" });
const sizeOverLifetimeBinding = sizeOverLifetimeFolder.addBinding(rt.params, "sizeOverLifetime", {
  label: "Size",
  x: { min: 0, max: 6, step: 0.01 },
  y: { min: 0, max: 6, step: 0.01 },
});
const sizeOverLifetimeBezierBlade = sizeOverLifetimeFolder.addBlade({
  view: "cubicbezier",
  label: "Curve Shape",
  value: rt.params.sizeOverLifetimeBezier,
  picker: "inline",
  expanded: true,
});
(sizeOverLifetimeBezierBlade as unknown as {
  on: (event: string, handler: (ev: { value: unknown }) => void) => void;
}).on("change", (ev) => {
  rt.params.sizeOverLifetimeBezier = normalizeCubicBezierValue(ev.value, rt.params.sizeOverLifetimeBezier);
  rt.applyParamsToPreset();
  rt.refreshDiagnostics();
  updateLifetimeModifierVisibility();
  rt.jsonPane.refresh();
  rt.respawn();
});

const colorOverLifetimeFolder = pane.addFolder({ title: "Color Over Lifetime", expanded: false });
const colorOverLifetimeEnabledBinding = colorOverLifetimeFolder.addBinding(rt.params, "colorOverLifetimeEnabled", { label: "Enabled" });
const lifetimeGradientBinding = colorOverLifetimeFolder.addBinding(rt.params, "lifetimeGradient", { label: "Gradient", view: "gradient" });

const limitVelocityFolder = pane.addFolder({ title: "Limit Velocity Over Lifetime", expanded: false });
const limitVelocityEnabledBinding = limitVelocityFolder.addBinding(rt.params, "limitVelocityEnabled", { label: "Enabled" });
const limitVelocitySpeedBinding = limitVelocityFolder.addBinding(rt.params, "limitVelocitySpeed", {
  label: "Speed",
  x: { min: 0, max: 100, step: 0.01 },
  y: { min: 0, max: 100, step: 0.01 },
});
const limitVelocityDampenBinding = limitVelocityFolder.addBinding(rt.params, "limitVelocityDampen", {
  label: "Dampen",
  min: 0,
  max: 1,
  step: 0.01,
});

const colorBySpeedFolder = pane.addFolder({ title: "Color By Speed", expanded: false });
const colorBySpeedEnabledBinding = colorBySpeedFolder.addBinding(rt.params, "colorBySpeedEnabled", { label: "Enabled" });
const colorBySpeedRangeBinding = colorBySpeedFolder.addBinding(rt.params, "colorBySpeedRange", {
  label: "Speed Range",
  x: { min: 0, max: 100, step: 0.01 },
  y: { min: 0, max: 100, step: 0.01 },
});
const colorBySpeedGradientBinding = colorBySpeedFolder.addBinding(rt.params, "colorBySpeedGradient", { label: "Gradient", view: "gradient" });

const sizeBySpeedFolder = pane.addFolder({ title: "Size By Speed", expanded: false });
const sizeBySpeedEnabledBinding = sizeBySpeedFolder.addBinding(rt.params, "sizeBySpeedEnabled", { label: "Enabled" });
const sizeBySpeedRangeBinding = sizeBySpeedFolder.addBinding(rt.params, "sizeBySpeedRange", {
  label: "Speed Range",
  x: { min: 0, max: 100, step: 0.01 },
  y: { min: 0, max: 100, step: 0.01 },
});
const sizeBySpeedMultiplierBinding = sizeBySpeedFolder.addBinding(rt.params, "sizeBySpeedMultiplier", {
  label: "Size Multiplier",
  x: { min: 0, max: 6, step: 0.01 },
  y: { min: 0, max: 6, step: 0.01 },
});

const rotationBySpeedFolder = pane.addFolder({ title: "Rotation By Speed", expanded: false });
const rotationBySpeedEnabledBinding = rotationBySpeedFolder.addBinding(rt.params, "rotationBySpeedEnabled", { label: "Enabled" });
const rotationBySpeedRangeBinding = rotationBySpeedFolder.addBinding(rt.params, "rotationBySpeedRange", {
  label: "Speed Range",
  x: { min: 0, max: 100, step: 0.01 },
  y: { min: 0, max: 100, step: 0.01 },
});
const rotationBySpeedAngularBinding = rotationBySpeedFolder.addBinding(rt.params, "rotationBySpeedAngular", {
  label: "Angular Velocity",
  x: { min: -20, max: 20, step: 0.01 },
  y: { min: -20, max: 20, step: 0.01 },
});

function updateLifetimeModifierVisibility(): void {
  velocityLinearXBinding.hidden = !rt.params.velocityOverLifetimeEnabled;
  velocityLinearYBinding.hidden = !rt.params.velocityOverLifetimeEnabled;
  velocityLinearZBinding.hidden = !rt.params.velocityOverLifetimeEnabled;

  sizeOverLifetimeBinding.hidden = !rt.params.sizeOverLifetimeEnabled;
  sizeOverLifetimeBezierBlade.hidden = !rt.params.sizeOverLifetimeEnabled;
  lifetimeGradientBinding.hidden = !rt.params.colorOverLifetimeEnabled;

  limitVelocitySpeedBinding.hidden = !rt.params.limitVelocityEnabled;
  limitVelocityDampenBinding.hidden = !rt.params.limitVelocityEnabled;

  colorBySpeedRangeBinding.hidden = !rt.params.colorBySpeedEnabled;
  colorBySpeedGradientBinding.hidden = !rt.params.colorBySpeedEnabled;

  sizeBySpeedRangeBinding.hidden = !rt.params.sizeBySpeedEnabled;
  sizeBySpeedMultiplierBinding.hidden = !rt.params.sizeBySpeedEnabled;

  rotationBySpeedRangeBinding.hidden = !rt.params.rotationBySpeedEnabled;
  rotationBySpeedAngularBinding.hidden = !rt.params.rotationBySpeedEnabled;

  setFolderTitleEnabledState(velocityOverLifetimeFolder, rt.params.velocityOverLifetimeEnabled);
  setFolderTitleEnabledState(sizeOverLifetimeFolder, rt.params.sizeOverLifetimeEnabled);
  setFolderTitleEnabledState(colorOverLifetimeFolder, rt.params.colorOverLifetimeEnabled);
  setFolderTitleEnabledState(limitVelocityFolder, rt.params.limitVelocityEnabled);
  setFolderTitleEnabledState(colorBySpeedFolder, rt.params.colorBySpeedEnabled);
  setFolderTitleEnabledState(sizeBySpeedFolder, rt.params.sizeBySpeedEnabled);
  setFolderTitleEnabledState(rotationBySpeedFolder, rt.params.rotationBySpeedEnabled);
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
const rendererTypeBinding = rendererStyleFolder.addBinding(rt.params, "rendererType", {
  label: "Type",
  options: { billboard: "billboard", stretchedBillboard: "stretchedBillboard" },
});
rendererStyleFolder.addBinding(rt.params, "rendererTexture", {
  label: "Texture",
  options: { softDisc: "softDisc", hardDisc: "hardDisc", spark: "spark" },
});
const rendererStretchFactorBinding = rendererStyleFolder.addBinding(rt.params, "rendererStretchFactor", {
  label: "Stretch Factor",
  min: 0,
  max: 8,
  step: 0.01,
});
const rendererStretchMaxScaleBinding = rendererStyleFolder.addBinding(rt.params, "rendererStretchMaxScale", {
  label: "Stretch Max Scale",
  min: 1,
  max: 20,
  step: 0.01,
});

const rendererCompositingFolder = rendererFolder.addFolder({ title: "Compositing", expanded: false });
rendererCompositingFolder.addBinding(rt.params, "rendererBlendMode", {
  label: "Blend",
  options: { alpha: "alpha", additive: "additive", multiply: "multiply" },
});
rendererCompositingFolder.addBinding(rt.params, "rendererAlign", { label: "Align", options: { camera: "camera", velocity: "velocity" } });
rendererCompositingFolder.addBinding(rt.params, "rendererSorting", {
  label: "Sorting (CPU only)",
  options: { none: "none", distance: "distance", youngestFirst: "youngestFirst", oldestFirst: "oldestFirst" },
});

const rendererDepthFolder = rendererFolder.addFolder({ title: "Depth", expanded: false });
rendererDepthFolder.addBinding(rt.params, "rendererDepthWrite", { label: "Depth Write" });
rendererDepthFolder.addBinding(rt.params, "rendererDepthTest", { label: "Depth Test" });
const rendererSoftParticlesBinding = rendererDepthFolder.addBinding(rt.params, "rendererSoftParticles", { label: "Soft Particles" });
const rendererSoftnessBinding = rendererDepthFolder.addBinding(rt.params, "rendererSoftness", {
  label: "Softness",
  min: 0.01,
  max: 8,
  step: 0.01,
});

const rendererAlphaFolder = rendererFolder.addFolder({ title: "Texture Processing", expanded: false });
const rendererAlphaEnabledBinding = rendererAlphaFolder.addBinding(rt.params, "rendererAlphaFromLuminanceEnabled", {
  label: "Alpha From Luminance",
});
const rendererAlphaBlackCutoffBinding = rendererAlphaFolder.addBinding(rt.params, "rendererAlphaFromLuminanceBlackCutoff", {
  label: "Black Cutoff",
  min: 0,
  max: 255,
  step: 1,
});

const rendererTextureSheetFolder = rendererFolder.addFolder({ title: "Texture Sheet", expanded: false });
const rendererTextureSheetEnabledBinding = rendererTextureSheetFolder.addBinding(rt.params, "rendererTextureSheetEnabled", {
  label: "Enabled",
});
const rendererTextureSheetTextureNameBinding = rendererTextureSheetFolder.addBinding(rt.params, "rendererTextureSheetTextureName", {
  label: "Sheet",
  readonly: true,
});
const rendererTextureSheetColumnsBinding = rendererTextureSheetFolder.addBinding(rt.params, "rendererTextureSheetColumns", {
  label: "Columns",
  min: 1,
  max: 16,
  step: 1,
});
const rendererTextureSheetRowsBinding = rendererTextureSheetFolder.addBinding(rt.params, "rendererTextureSheetRows", {
  label: "Rows",
  min: 1,
  max: 16,
  step: 1,
});
const rendererTextureSheetModeBinding = rendererTextureSheetFolder.addBinding(rt.params, "rendererTextureSheetAnimationMode", {
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
  rt.customRendererTexture.value = undefined;
  rt.params.rendererTextureSheetTextureName = "Built-in";
  rt.applyParamsToPreset();
  rt.refreshDiagnostics();
  updateRendererVisibility();
  rt.jsonPane.refresh();
  rt.respawn();
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
  rt.customRendererTexture.value = texture;
  rt.params.rendererTextureSheetTextureName = file.name;
  if (rt.customRendererTextureObjectUrl) URL.revokeObjectURL(rt.customRendererTextureObjectUrl);
  rt.customRendererTextureObjectUrl = objectUrl;
  rt.applyParamsToPreset();
  rt.refreshDiagnostics();
  updateRendererVisibility();
  rt.jsonPane.refresh();
  rt.respawn();
}

function updateRendererSheetPreview(): void {
  if (!rt.rendererSheetPreviewCanvas) return;
  const ctx = rt.rendererSheetPreviewCanvas.getContext("2d");
  if (!ctx) return;
  const width = rt.rendererSheetPreviewCanvas.width;
  const height = rt.rendererSheetPreviewCanvas.height;
  ctx.clearRect(0, 0, width, height);

  const image = rt.customRendererTexture.value?.image;
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
  rt.rendererSheetPreviewCanvas = previewCanvas;

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
const dispersalEnabledBinding = dispersalFolder.addBinding(rt.params, "dispersalEnabled", { label: "Enabled" });
const dispersalTextureNameBinding = dispersalFolder.addBinding(rt.params, "dispersalTextureName", { label: "Texture", readonly: true });
const dispersalStrengthBinding = dispersalFolder.addBinding(rt.params, "dispersalStrength", {
  label: "Strength",
  min: 0,
  max: 1,
  step: 0.01,
});
const dispersalAmountBinding = dispersalFolder.addBinding(rt.params, "dispersalAmount", {
  label: "Amount",
  x: { min: 0, max: 1, step: 0.01 },
  y: { min: 0, max: 1, step: 0.01 },
});
const dispersalStartAtBinding = dispersalFolder.addBinding(rt.params, "dispersalStartAt", {
  label: "Start At",
  min: 0,
  max: 1,
  step: 0.01,
});
const dispersalNoiseScaleBinding = dispersalFolder.addBinding(rt.params, "dispersalNoiseScale", {
  label: "Noise Scale",
  min: 0.01,
  max: 20,
  step: 0.01,
});
const dispersalEdgeSoftnessBinding = dispersalFolder.addBinding(rt.params, "dispersalEdgeSoftness", {
  label: "Edge Softness",
  min: 0.001,
  max: 2,
  step: 0.001,
});
const dispersalScrollBinding = dispersalFolder.addBinding(rt.params, "dispersalScroll", {
  label: "Scroll",
  x: { min: -2, max: 2, step: 0.001 },
  y: { min: -2, max: 2, step: 0.001 },
});
const clearDispersalTextureButton = dispersalFolder.addButton({ title: "Clear Texture" });
clearDispersalTextureButton.on("click", () => {
  rt.customDispersalTexture.value = undefined;
  rt.params.dispersalTextureName = "Built-in noise";
  rt.applyParamsToPreset();
  rt.refreshDiagnostics();
  updateDispersalVisibility();
  rt.jsonPane.refresh();
  rt.respawn();
});

function updateDispersalPreview(): void {
  if (!rt.dispersalPreviewCanvas) return;
  const ctx = rt.dispersalPreviewCanvas.getContext("2d");
  if (!ctx) return;
  const width = rt.dispersalPreviewCanvas.width;
  const height = rt.dispersalPreviewCanvas.height;

  ctx.clearRect(0, 0, width, height);
  const customImage = rt.customDispersalTexture.value?.image;
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
  const scale = Math.max(0.01, rt.params.dispersalNoiseScale);
  const scrollX = rt.params.dispersalScroll.x * 4;
  const scrollY = rt.params.dispersalScroll.y * 4;
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
  rt.customDispersalTexture.value = texture;
  rt.params.dispersalTextureName = file.name;
  if (rt.customDispersalTextureObjectUrl) URL.revokeObjectURL(rt.customDispersalTextureObjectUrl);
  rt.customDispersalTextureObjectUrl = objectUrl;
  rt.applyParamsToPreset();
  rt.refreshDiagnostics();
  updateDispersalVisibility();
  updateDispersalPreview();
  rt.jsonPane.refresh();
  rt.respawn();
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
  rt.dispersalPreviewCanvas = previewCanvas;
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
  if (dispersalDropzone) dispersalDropzone.style.display = rt.params.dispersalEnabled ? "" : "none";
  dispersalTextureNameBinding.hidden = !rt.params.dispersalEnabled;
  dispersalStrengthBinding.hidden = !rt.params.dispersalEnabled;
  dispersalAmountBinding.hidden = !rt.params.dispersalEnabled;
  dispersalStartAtBinding.hidden = !rt.params.dispersalEnabled;
  dispersalNoiseScaleBinding.hidden = !rt.params.dispersalEnabled;
  dispersalEdgeSoftnessBinding.hidden = !rt.params.dispersalEnabled;
  dispersalScrollBinding.hidden = !rt.params.dispersalEnabled;
  setFolderTitleEnabledState(dispersalFolder, rt.params.dispersalEnabled);
  updateDispersalPreview();
}
dispersalEnabledBinding.on("change", () => updateDispersalVisibility());

function updateRendererVisibility(): void {
  const isStretched = rt.params.rendererType === "stretchedBillboard";
  rendererStretchFactorBinding.hidden = !isStretched;
  rendererStretchMaxScaleBinding.hidden = !isStretched;
  rendererSoftnessBinding.hidden = !rt.params.rendererSoftParticles;
  rendererAlphaBlackCutoffBinding.hidden = !rt.params.rendererAlphaFromLuminanceEnabled;
  rendererTextureSheetColumnsBinding.hidden = !rt.params.rendererTextureSheetEnabled;
  rendererTextureSheetRowsBinding.hidden = !rt.params.rendererTextureSheetEnabled;
  rendererTextureSheetModeBinding.hidden = !rt.params.rendererTextureSheetEnabled;
  rendererTextureSheetTextureNameBinding.hidden = !rt.params.rendererTextureSheetEnabled;
  clearRendererTextureSheetButton.hidden = !rt.params.rendererTextureSheetEnabled;
  const sheetDropzone = (rendererTextureSheetFolder as { element?: HTMLElement }).element?.querySelector<HTMLElement>(".renderer-sheet-dropzone");
  if (sheetDropzone) sheetDropzone.style.display = rt.params.rendererTextureSheetEnabled ? "" : "none";
  const sheetPreviewLabel = (rendererTextureSheetFolder as { element?: HTMLElement }).element?.querySelector<HTMLElement>(".renderer-sheet-preview-label");
  if (sheetPreviewLabel) sheetPreviewLabel.style.display = rt.params.rendererTextureSheetEnabled ? "" : "none";
  const sheetPreviewCanvas = (rendererTextureSheetFolder as { element?: HTMLElement }).element?.querySelector<HTMLElement>(".renderer-sheet-preview-canvas");
  if (sheetPreviewCanvas) sheetPreviewCanvas.style.display = rt.params.rendererTextureSheetEnabled ? "" : "none";
  updateRendererSheetPreview();

  setFolderTitleEnabledState(rendererDepthFolder, rt.params.rendererSoftParticles);
  setFolderTitleEnabledState(rendererAlphaFolder, rt.params.rendererAlphaFromLuminanceEnabled);
  setFolderTitleEnabledState(rendererTextureSheetFolder, rt.params.rendererTextureSheetEnabled);
}
rendererTypeBinding.on("change", () => updateRendererVisibility());
rendererSoftParticlesBinding.on("change", () => updateRendererVisibility());
rendererAlphaEnabledBinding.on("change", () => updateRendererVisibility());
rendererTextureSheetEnabledBinding.on("change", () => updateRendererVisibility());

const actionsFolder = pane.addFolder({ title: "Actions", expanded: false });
actionsFolder.addButton({ title: "Reset to baseline" }).on("click", () => {
  const selected = rt.ensureSelectedLayer();
  selected.preset = clonePreset(rt.baselinePreset);
  rt.workingPreset = selected.preset;
  rt.syncParamsFromPreset();
  updateRendererVisibility();
  updateDispersalVisibility();
  rt.refreshDiagnostics();
  rt.refreshPaneSafely();
  rt.respawn();
});
actionsFolder.addButton({ title: "Restart effect" }).on("click", () => rt.getSelectedActiveSystem()?.restart());
actionsFolder.addButton({ title: "Copy JSON" }).on("click", async () => {
  await navigator.clipboard.writeText(stringifyPreset(rt.ensureSelectedLayer().preset, true));
});

const jsonContent = rt.jsonPane.addBinding(rt.params, "exportJson", {
  label: "Wisp effects JSON",
  multiline: true,
  rows: 24,
  readonly: true,
});
jsonContent.on("change", () => {
  if (rt.isRefreshingPane) return;
});
rt.jsonPane.addButton({ title: "Copy Export JSON" }).on("click", async () => {
  await navigator.clipboard.writeText(rt.params.exportJson);
});

const importContent = rt.importPane.addBinding(rt.params, "importJson", {
  label: "Wisp effects JSON",
  multiline: true,
  rows: 24,
});
importContent.on("change", () => {
  if (rt.isRefreshingPane) return;
  if (rt.params.importStatus) {
    rt.params.importStatus = "";
    rt.importPane.refresh();
  }
});
const importStatusBinding = rt.importPane.addBinding(rt.params, "importStatus", {
  label: "",
  multiline: true,
  rows: 4,
  readonly: true,
});
importStatusBinding.element.classList.add("import-status-binding");
rt.importPane.addButton({ title: "Load Import JSON" }).on("click", () => {
  const source = rt.params.importJson.trim();
  if (!source) {
    rt.params.importStatus = "Paste JSON before importing.";
    rt.importPane.refresh();
    return;
  }
  try {
    const payload = parseImportEffectsPayload(source);
    const importedLayers = buildLayersFromImportEffectsPayload(payload, rt.layerIdCounter);
    if (importedLayers.length === 0) {
      rt.params.importStatus = "No effect layers found in import.";
      rt.importPane.refresh();
      return;
    }
    rt.layers.splice(0, rt.layers.length, ...importedLayers);
    const firstLayerId = importedLayers[0]?.id;
    if (firstLayerId) rt.setSelectedLayerById(firstLayerId);
    rt.syncParamsFromPreset();
    rt.refreshDiagnostics();
    rt.refreshLayersSummary();
    rt.rebuildLayersPaneFolders();
    rt.refreshPaneSafely();
    rt.jsonPane.refresh();
    rt.diagnosticsPane.refresh();
    rt.respawn();
    rt.params.importStatus = `Imported ${importedLayers.length} layer(s).`;
  } catch (error) {
    rt.params.importStatus = `Import failed: ${(error as Error).message}`;
  }
  rt.importPane.refresh();
});
rt.importPane.addButton({ title: "Paste from Clipboard" }).on("click", async () => {
  try {
    rt.params.importJson = await navigator.clipboard.readText();
    rt.params.importStatus = rt.params.importJson.trim().length > 0
      ? "Clipboard JSON pasted."
      : "Clipboard is empty.";
  } catch (error) {
    rt.params.importStatus = `Could not read clipboard: ${(error as Error).message}`;
  }
  rt.importPane.refresh();
});
  rt.pane = pane;
  rt.updateEmissionVisibility = updateEmissionVisibility;
  rt.updateEmitterVisibility = updateEmitterVisibility;
  rt.updateStartVisibility = updateStartVisibility;
  rt.updateForcesVisibility = updateForcesVisibility;
  rt.updateLifetimeModifierVisibility = updateLifetimeModifierVisibility;
  rt.updateRendererVisibility = updateRendererVisibility;
  rt.updateDispersalVisibility = updateDispersalVisibility;
}
