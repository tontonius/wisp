import * as THREE from "three";
import { collectParticlePresetIssues, Wisp } from "../src";
import type { ParticlePreset, ParticleSystem } from "../src";
import { installLayersPane } from "./panels/layers-pane.js";
import { installParticleEditorPane } from "./panels/particle-editor-pane.js";
import { installScenePane } from "./panels/scene-pane.js";
import { installDiagnosticsPane } from "./panels/diagnostics-pane.js";
import { installDebugPane } from "./panels/debug-pane.js";
import type { PanelRuntime } from "./panel-runtime.js";
import { createViewport } from "./scene/viewport.js";
import { updateEmitterMovement } from "./scene/movement.js";
import {
  makeHardDiscTexture,
  makeSoftDiscTexture,
  makeSparkTexture,
} from "./lib/textures.js";
import { clonePreset } from "./lib/preset-utils.js";
import { createSafePresetSerializer, stringifyPreset } from "./lib/preset-io.js";
import { buildExportEffectsPayload } from "./state/export.js";
import {
  applyParamsToPreset as applyParamsToPresetImpl,
  syncParamsFromPreset as syncParamsFromPresetImpl,
  type PresetSyncApplyContext,
} from "./state/preset-bridge.js";
import { createInitialEditorParams } from "./state/params.js";
import {
  createLayer,
  createRuntimePresetForLayer,
  getActiveLayerSystems,
  sanitizeLayerEventLinks,
  layerRuntimeName,
  type EditorLayer,
} from "./state/layers.js";

export function startEditor(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("Missing #app root.");
  app.innerHTML = `
  <canvas id="viewport-canvas"></canvas>
  <div id="pane-right-group" class="pane-dock pane-dock-right-group">
    <div id="pane-scene"></div>
    <div id="pane-layers"></div>
  </div>
  <div id="pane-editor" class="pane-dock pane-dock-left"></div>
  <div id="pane-diagnostics" class="pane-dock pane-dock-bottom"></div>
  <div id="pane-debug" class="pane-dock pane-dock-bottom-right"></div>
`;
  const canvas = document.querySelector<HTMLCanvasElement>("#viewport-canvas")!;
  const scenePaneHost = document.querySelector<HTMLDivElement>("#pane-scene")!;
  const layersPaneHost = document.querySelector<HTMLDivElement>("#pane-layers")!;
  const editorPaneHost = document.querySelector<HTMLDivElement>("#pane-editor")!;
  const diagnosticsPaneHost = document.querySelector<HTMLDivElement>("#pane-diagnostics")!;
  const debugPaneHost = document.querySelector<HTMLDivElement>("#pane-debug")!;

  const vp = createViewport(canvas);
  let sceneDepthTarget = vp.createSceneDepthTarget();

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
      size: [0.4, 0.4],
      color: "rgb(255,255,255)",
      opacity: [1, 1],
      rotation: [0, 0],
      angularVelocity: [0, 0],
    },
    forces: {
      acceleration: [0, 0, 0],
      drag: 0,
    },
    renderer: {
      texture: softDisc,
      blendMode: "alpha",
      align: "camera",
      sorting: "distance",
      depthWrite: false,
      type: "billboard",
      depthTest: true,
      softParticles: false,
      softness: 1.5,
    },
  };

  let baselinePreset = clonePreset(defaultPresetTemplate);

  const layerIdCounter = { next: 1 };
  const layers: EditorLayer[] = [createLayer(clonePreset(defaultPresetTemplate), layerIdCounter)];
  let selectedLayerId = layers[0].id;
  let workingPreset = layers[0].preset;

  const activeSystemsByLayerId = new Map<string, ParticleSystem>();
  const pendingSpawnTimers = new Map<string, number>();

  let isRefreshingPane = false;

  const customRendererTexture = { value: undefined as THREE.Texture | undefined };
  const customDispersalTexture = { value: undefined as THREE.Texture | undefined };

  const params = createInitialEditorParams();

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
    enabled: true,
    playbackTime: 0,
    playbackSpeed: 1,
    autoOrbit: false,
    orbitSpeedDegPerSec: 18,
    movementEnabled: false,
    movementMode: "circleLinear" as "circleLinear" | "stationary",
    movementSpeed: 1,
  };

  let runtimeStatsRefreshElapsed = 0;
  let movementElapsed = 0;
  let debugPlaybackDuration = Math.max(0.01, layers[0].preset.duration ?? 1);
  let debugPlaybackMode: "play" | "pause" = "play";
  let debugPlaybackBinding:
    | {
        dispose?: () => void;
        label?: string;
        on?: (event: string, handler: (ev: { value: number; last?: boolean }) => void) => void;
      }
    | undefined;

  const layersPaneParams = { layerSummary: "" };
  const layersPaneDynamicDisposables: Array<{ dispose?: () => void }> = [];
  const layersPaneDynamicCleanups: Array<() => void> = [];

  const wisp = new Wisp({
    scene: vp.scene,
    camera: vp.camera,
    particles: { renderer: vp.renderer },
  });

  function refreshExportJson(): void {
    params.exportJson = JSON.stringify(buildExportEffectsPayload(layers), createSafePresetSerializer(), 2);
  }

  function getPresetBridge(): PresetSyncApplyContext {
    return {
      params,
      workingPreset,
      softDisc,
      hardDisc,
      spark,
      customRendererTexture,
      customDispersalTexture,
      refreshExportJson,
    };
  }

  function syncParamsFromPreset(): void {
    syncParamsFromPresetImpl(getPresetBridge());
  }

  function applyParamsToPreset(): void {
    applyParamsToPresetImpl(getPresetBridge());
  }

  function refreshDiagnostics(): void {
    const issues = collectParticlePresetIssues(workingPreset, { renderer: vp.renderer });
    if (issues.errors.length === 0 && issues.warnings.length === 0) {
      params.diagnostics = "No validation issues.";
    } else {
      params.diagnostics = [...issues.errors.map((e) => `error: ${e}`), ...issues.warnings.map((w) => `warn: ${w}`)]
        .slice(0, 10)
        .join(" | ");
    }
  }

  function getSelectedLayer(): EditorLayer | undefined {
    return layers.find((layer) => layer.id === selectedLayerId);
  }

  function ensureSelectedLayer(): EditorLayer {
    let layer = getSelectedLayer();
    if (layer) return layer;
    if (layers.length === 0) {
      layers.push(createLayer(clonePreset(defaultPresetTemplate), layerIdCounter));
    }
    layer = layers[0];
    selectedLayerId = layer.id;
    workingPreset = layer.preset;
    return layer;
  }

  function setSelectedLayerById(id: string): void {
    const layer = layers.find((entry) => entry.id === id);
    if (!layer) return;
    selectedLayerId = id;
    workingPreset = layer.preset;
  }

  function getSelectedActiveSystem(): ParticleSystem | undefined {
    return activeSystemsByLayerId.get(selectedLayerId);
  }

  function respawn(): void {
    const particles = wisp.particles;
    if (!particles) return;
    refreshExportJson();
    for (const timerId of pendingSpawnTimers.values()) window.clearTimeout(timerId);
    pendingSpawnTimers.clear();
    for (const system of activeSystemsByLayerId.values()) system.dispose();
    activeSystemsByLayerId.clear();
    sanitizeLayerEventLinks(layers);
    for (const layer of layers) {
      particles.register(layerRuntimeName(layer.id), createRuntimePresetForLayer(layer));
    }

    const soloed = layers.filter((layer) => layer.solo && !layer.muted);
    const activeLayers = soloed.length > 0 ? soloed : layers.filter((layer) => !layer.muted);
    for (const layer of activeLayers) {
      const sysKey = layerRuntimeName(layer.id);
      const spawnLayer = (): void => {
        const system = particles.spawn(sysKey, { position: [0, 0.02, 0] });
        activeSystemsByLayerId.set(layer.id, system);
        if (debugPlaybackMode === "pause") system.pause();
      };
      if (layer.startOffsetSec > 0) {
        const timerId = window.setTimeout(() => {
          pendingSpawnTimers.delete(layer.id);
          spawnLayer();
        }, Math.max(0, layer.startOffsetSec) * 1000);
        pendingSpawnTimers.set(layer.id, timerId);
      } else {
        spawnLayer();
      }
    }
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

  function renderSceneDepthWithoutParticles(): void {
    if (!wisp.particles) return;
    const hiddenSystems: THREE.Object3D[] = [];
    for (const system of wisp.particles.systems) {
      const object = system as unknown as THREE.Object3D;
      if (!object.visible) continue;
      object.visible = false;
      hiddenSystems.push(object);
    }

    const previousTarget = vp.renderer.getRenderTarget();
    vp.renderer.setRenderTarget(sceneDepthTarget);
    vp.renderer.clear(true, true, false);
    vp.renderer.render(vp.scene, vp.camera);
    vp.renderer.setRenderTarget(previousTarget);

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

  const rt = {
    canvas,
    scene: vp.scene,
    camera: vp.camera,
    renderer: vp.renderer,
    orbitControls: vp.orbitControls,
    wisp,
    sceneDepthTarget,
    createSceneDepthTarget: vp.createSceneDepthTarget,
    floor: vp.floor,
    floorMaterial: vp.floorMaterial,
    sceneParams: vp.sceneParams,
    softDisc,
    hardDisc,
    spark,
    defaultPresetTemplate,
    baselinePreset,
    layers,
    selectedLayerId,
    workingPreset,
    layerIdCounter,
    activeSystemsByLayerId,
    pendingSpawnTimers,
    isRefreshingPane,
    customRendererTexture,
    customRendererTextureObjectUrl: undefined as string | undefined,
    rendererSheetPreviewCanvas: null as HTMLCanvasElement | null,
    customDispersalTexture,
    customDispersalTextureObjectUrl: undefined as string | undefined,
    dispersalPreviewCanvas: null as HTMLCanvasElement | null,
    params,
    runtimeStats,
    globalDebugParams,
    runtimeStatsRefreshElapsed,
    movementElapsed,
    debugPlaybackDuration,
    debugPlaybackMode,
    debugPlaybackBinding,
    layersPaneParams,
    layersPaneDynamicDisposables,
    layersPaneDynamicCleanups,
    layersPane: undefined as unknown as PanelRuntime["layersPane"],
    jsonPane: undefined as unknown as PanelRuntime["jsonPane"],
    layersRootPane: undefined as unknown as PanelRuntime["layersRootPane"],
    scenePane: undefined as unknown as PanelRuntime["scenePane"],
    diagnosticsPane: undefined as unknown as PanelRuntime["diagnosticsPane"],
    debugPane: undefined as unknown as PanelRuntime["debugPane"],
    pane: undefined as unknown as PanelRuntime["pane"],
    fpsGraph: undefined as unknown as PanelRuntime["fpsGraph"],
  } as PanelRuntime;

  rt.refreshExportJson = refreshExportJson;
  rt.syncParamsFromPreset = syncParamsFromPreset;
  rt.applyParamsToPreset = applyParamsToPreset;
  rt.refreshDiagnostics = refreshDiagnostics;
  rt.refreshRuntimeStats = refreshRuntimeStats;
  rt.renderSceneDepthWithoutParticles = renderSceneDepthWithoutParticles;
  rt.syncSoftParticleDepthTexture = syncSoftParticleDepthTexture;
  rt.respawn = respawn;
  rt.ensureSelectedLayer = ensureSelectedLayer;
  rt.setSelectedLayerById = setSelectedLayerById;
  rt.getSelectedActiveSystem = getSelectedActiveSystem;
  rt.getActiveLayerSystems = () => getActiveLayerSystems(rt.layers, rt.activeSystemsByLayerId);

  Object.defineProperty(rt, "selectedLayerId", {
    get() {
      return selectedLayerId;
    },
    set(v: string) {
      selectedLayerId = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(rt, "workingPreset", {
    get() {
      return workingPreset;
    },
    set(v: ParticlePreset) {
      workingPreset = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(rt, "baselinePreset", {
    get() {
      return baselinePreset;
    },
    set(v: ParticlePreset) {
      baselinePreset = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(rt, "isRefreshingPane", {
    get() {
      return isRefreshingPane;
    },
    set(v: boolean) {
      isRefreshingPane = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(rt, "debugPlaybackDuration", {
    get() {
      return debugPlaybackDuration;
    },
    set(v: number) {
      debugPlaybackDuration = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(rt, "debugPlaybackMode", {
    get() {
      return debugPlaybackMode;
    },
    set(v: "play" | "pause") {
      debugPlaybackMode = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(rt, "debugPlaybackBinding", {
    get() {
      return debugPlaybackBinding;
    },
    set(v: typeof debugPlaybackBinding) {
      debugPlaybackBinding = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(rt, "runtimeStatsRefreshElapsed", {
    get() {
      return runtimeStatsRefreshElapsed;
    },
    set(v: number) {
      runtimeStatsRefreshElapsed = v;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(rt, "movementElapsed", {
    get() {
      return movementElapsed;
    },
    set(v: number) {
      movementElapsed = v;
    },
    enumerable: true,
    configurable: true,
  });

  function refreshPaneSafely(): void {
    isRefreshingPane = true;
    rt.pane.refresh();
    isRefreshingPane = false;
  }

  rt.refreshPaneSafely = refreshPaneSafely;

  installScenePane(rt, scenePaneHost);
  installLayersPane(rt, layersPaneHost);
  installParticleEditorPane(rt, editorPaneHost);
  installDiagnosticsPane(rt, diagnosticsPaneHost);
  installDebugPane(rt, debugPaneHost);

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    vp.renderer.setSize(width, height, false);
    sceneDepthTarget.dispose();
    sceneDepthTarget = vp.createSceneDepthTarget();
    rt.sceneDepthTarget = sceneDepthTarget;
    syncSoftParticleDepthTexture();
    vp.camera.aspect = width / height;
    vp.camera.updateProjectionMatrix();
  }

  rt.resize = resize;

  rt.pane.on("change", () => {
    if (rt.isRefreshingPane) return;
    const beforePresetJson = stringifyPreset(workingPreset);
    applyParamsToPreset();
    const didPresetChange = beforePresetJson !== stringifyPreset(workingPreset);
    rt.refreshDiagnostics();
    rt.updateEmissionVisibility();
    rt.updateEmitterVisibility();
    rt.updateStartVisibility();
    rt.updateForcesVisibility();
    rt.updateLifetimeModifierVisibility();
    rt.updateRendererVisibility();
    rt.updateDispersalVisibility();
    rt.jsonPane.refresh();
    if (didPresetChange) {
      rt.respawn();
      if (rt.debugPlaybackMode === "pause") {
        for (const system of rt.getActiveLayerSystems()) system.pause();
      }
    }
  });

  window.addEventListener("resize", resize);
  resize();

  const timer = new THREE.Timer();
  function tick(): void {
    rt.fpsGraph.begin();
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.033);
    const simulationDt = dt * Math.max(0, rt.globalDebugParams.playbackSpeed);
    rt.orbitControls.autoRotate = rt.globalDebugParams.autoOrbit;
    rt.orbitControls.autoRotateSpeed = rt.globalDebugParams.orbitSpeedDegPerSec / 6;
    rt.orbitControls.update();
    updateEmitterMovement(simulationDt, rt);
    wisp.update(simulationDt, vp.camera);
    renderSceneDepthWithoutParticles();
    syncSoftParticleDepthTexture();
    vp.renderer.render(vp.scene, vp.camera);
    rt.fpsGraph.end();

    rt.runtimeStatsRefreshElapsed += dt;
    if (rt.runtimeStatsRefreshElapsed >= 0.2) {
      rt.runtimeStatsRefreshElapsed = 0;
      rt.refreshRuntimeStats();
    }

    const duration = Math.max(0.01, rt.ensureSelectedLayer().preset.duration ?? 1);
    if (Math.abs(duration - rt.debugPlaybackDuration) > 1e-6) {
      rt.debugPlaybackDuration = duration;
      rt.rebuildDebugPlaybackBinding();
    }
    const selectedSystem = rt.getSelectedActiveSystem();
    const selected = rt.ensureSelectedLayer();
    if (selectedSystem) {
      const elapsed = selectedSystem.elapsed;
      rt.globalDebugParams.playbackTime = selected.preset.loop ? elapsed % duration : Math.min(elapsed, duration);
    } else {
      rt.globalDebugParams.playbackTime = 0;
    }
    rt.debugPane.refresh();

    requestAnimationFrame(tick);
  }

  rt.syncParamsFromPreset();
  rt.refreshDiagnostics();
  rt.updateEmissionVisibility();
  rt.updateEmitterVisibility();
  rt.updateStartVisibility();
  rt.updateForcesVisibility();
  rt.updateLifetimeModifierVisibility();
  rt.updateRendererVisibility();
  rt.updateDispersalVisibility();
  rt.refreshPaneSafely();
  rt.jsonPane.refresh();
  rt.diagnosticsPane.refresh();
  rt.respawn();
  rt.refreshRuntimeStats();
  tick();
}
