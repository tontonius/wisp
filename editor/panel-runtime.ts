import type * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Pane } from "tweakpane";
import type { ParticlePreset, ParticleSystem } from "../src";
import type { Wisp } from "../src";
import type { EditorLayer } from "./state/layers";
import type { EditorViewMode } from "./state/editor-view-mode";
import type { EditorParams } from "./state/params";

/** Narrow facade passed into panel installers (avoids circular imports with types.ts). */
export type PanelRuntime = {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  orbitControls: OrbitControls;
  wisp: Wisp;

  sceneDepthTarget: THREE.WebGLRenderTarget;
  createSceneDepthTarget: () => THREE.WebGLRenderTarget;

  floor: THREE.Mesh;
  floorMaterial: THREE.MeshStandardMaterial;
  sceneParams: {
    groundVisible: boolean;
    groundColor: string;
    backgroundColor: string;
    fogEnabled: boolean;
    fogColor: string;
    fogNearFar: { x: number; y: number };
  };

  softDisc: THREE.Texture;
  hardDisc: THREE.Texture;
  spark: THREE.Texture;

  defaultPresetTemplate: ParticlePreset;
  baselinePreset: ParticlePreset;

  layers: EditorLayer[];
  selectedLayerId: string;
  workingPreset: ParticlePreset;
  layerIdCounter: { next: number };

  activeSystemsByLayerId: Map<string, ParticleSystem>;
  pendingSpawnTimers: Map<string, number>;

  isRefreshingPane: boolean;
  customRendererTexture: { value: THREE.Texture | undefined };
  customRendererTextureObjectUrl: string | undefined;
  rendererSheetPreviewCanvas: HTMLCanvasElement | null;
  customDispersalTexture: { value: THREE.Texture | undefined };
  customDispersalTextureObjectUrl: string | undefined;
  dispersalPreviewCanvas: HTMLCanvasElement | null;

  params: EditorParams;

  runtimeStats: {
    systems: number;
    cpuSystems: number;
    gpuSystems: number;
    aliveTotal: number;
    maxTotal: number;
    busiest: string;
    busiestAlive: number;
  };

  globalDebugParams: {
    enabled: boolean;
    playbackTime: number;
    playbackSpeed: number;
    autoOrbit: boolean;
    orbitSpeedDegPerSec: number;
    movementEnabled: boolean;
    movementMode: "circleLinear" | "stationary";
    movementSpeed: number;
  };
  editorViewMode: EditorViewMode;
  cameraShakeParams: {
    enabled: boolean;
    onRespawn: boolean;
    triggerTrauma: number;
    decayRate: number;
    traumaExponent: number;
    noiseFrequency: number;
    mode: "rotationOnly" | "rotationAndTranslation";
    maxPitchDeg: number;
    maxYawDeg: number;
    maxRollDeg: number;
    maxTranslation: { x: number; y: number; z: number };
  };
  cameraRuntime: {
    trauma: number;
  };

  runtimeStatsRefreshElapsed: number;
  movementElapsed: number;
  debugPlaybackDuration: number;
  debugPlaybackMode: "play" | "pause";
  debugPlaybackBinding:
    | {
        dispose?: () => void;
        label?: string;
        on?: (event: string, handler: (ev: { value: number; last?: boolean }) => void) => void;
      }
    | undefined;

  pane: Pane;
  layersPaneParams: { layerSummary: string };
  layersRootPane: Pane;
  layersPane: Pane;
  jsonPane: Pane;
  importPane: Pane;
  layersPaneDynamicDisposables: Array<{ dispose?: () => void }>;
  layersPaneDynamicCleanups: Array<() => void>;

  scenePane: Pane;
  cameraPane: Pane;
  motionPane: Pane;
  diagnosticsPane: Pane;
  debugPane: Pane;
  motionParams: {
    hoverEnabled: boolean;
    breatheEnabled: boolean;
    leanEnabled: boolean;
    autoPopEnabled: boolean;
  };
  motionActions: {
    setHoverEnabled: (enabled: boolean) => void;
    setBreatheEnabled: (enabled: boolean) => void;
    setLeanEnabled: (enabled: boolean) => void;
    setAutoPopEnabled: (enabled: boolean) => void;
    triggerPop: () => void;
    triggerSquash: () => void;
    triggerRecoil: () => void;
  };

  fpsGraph: { begin: () => void; end: () => void };

  refreshPaneSafely: () => void;
  refreshExportJson: () => void;
  respawn: () => void;
  syncParamsFromPreset: () => void;
  applyParamsToPreset: () => void;
  refreshDiagnostics: () => void;
  refreshRuntimeStats: () => void;
  renderSceneDepthWithoutParticles: () => void;
  syncSoftParticleDepthTexture: () => void;
  resize: () => void;
  setEditorViewMode: (mode: EditorViewMode) => void;

  selectLayerAndRefresh: (layerId: string) => void;
  rebuildLayersPaneFolders: () => void;
  refreshLayersSummary: () => void;

  updateEmissionVisibility: () => void;
  updateEmitterVisibility: () => void;
  updateStartVisibility: () => void;
  updateForcesVisibility: () => void;
  updateLifetimeModifierVisibility: () => void;
  updateRendererVisibility: () => void;
  updateDispersalVisibility: () => void;

  rebuildDebugPlaybackBinding: () => void;
  seekActiveSystemTo: (targetTime: number) => void;
  setDebugPlaybackMode: (mode: "play" | "pause") => void;
  updateDebugPlaybackButtons: () => void;

  ensureSelectedLayer: () => EditorLayer;
  setSelectedLayerById: (id: string) => void;
  getSelectedActiveSystem: () => ParticleSystem | undefined;
  getActiveLayerSystems: () => ParticleSystem[];
};
