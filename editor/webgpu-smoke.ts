import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "../src/webgpu";
import { ParticleSystem } from "../src/particles/system";
import type { ParticleComputeMode, ParticleMotionMode, ParticlePreset } from "../src/particles/types";
import "./style.css";
import smokeAtlasUrl from "./textures/smoke/2x2_smoke_puffs_256.png";
import dispersalMapUrl from "./textures/dispersion/square_disp_1_10pc.jpg";

type SmokeState = {
  phase: "booting" | "unsupported" | "ready" | "error";
  backend?: string;
  computeMode?: ParticleComputeMode;
  motionMode?: ParticleMotionMode;
  aliveCount?: number;
  error?: string;
};

declare global {
  interface Window {
    __WISP_WEBGPU_SMOKE__?: SmokeState;
  }
}

const root = document.querySelector<HTMLElement>("#webgpu-smoke");
const canvas = document.querySelector<HTMLCanvasElement>("#webgpu-smoke-canvas");
const phaseEl = document.querySelector<HTMLElement>('[data-status="phase"]');
const backendEl = document.querySelector<HTMLElement>('[data-status="backend"]');
const computeEl = document.querySelector<HTMLElement>('[data-status="compute"]');
const motionEl = document.querySelector<HTMLElement>('[data-status="motion"]');
const aliveEl = document.querySelector<HTMLElement>('[data-status="alive"]');

if (!root || !canvas || !phaseEl || !backendEl || !computeEl || !motionEl || !aliveEl) {
  throw new Error("WebGPU smoke harness markup is missing.");
}

const appRoot = root;
const smokeCanvas = canvas;
const smokePhaseEl = phaseEl;
const smokeBackendEl = backendEl;
const smokeComputeEl = computeEl;
const smokeMotionEl = motionEl;
const smokeAliveEl = aliveEl;

function setSmokeState(next: SmokeState): void {
  window.__WISP_WEBGPU_SMOKE__ = next;
  appRoot.dataset.phase = next.phase;
  smokePhaseEl.textContent = next.error ? `${next.phase}: ${next.error}` : next.phase;
  smokeBackendEl.textContent = `backend: ${next.backend ?? "unknown"}`;
  smokeComputeEl.textContent = `compute: ${next.computeMode ?? "unknown"}`;
  smokeMotionEl.textContent = `motion: ${next.motionMode ?? "unknown"}`;
  smokeAliveEl.textContent = `alive: ${next.aliveCount ?? 0}`;
}

async function loadSpriteTexture(): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(smokeAtlasUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

async function loadDispersalTexture(): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(dispersalMapUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function resizeRenderer(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function resizeDepthTarget(renderer: THREE.WebGPURenderer, target: THREE.RenderTarget): void {
  const size = renderer.getSize(new THREE.Vector2());
  const pixelRatio = renderer.getPixelRatio();
  const width = Math.max(1, Math.floor(size.x * pixelRatio));
  const height = Math.max(1, Math.floor(size.y * pixelRatio));
  if (target.width === width && target.height === height) return;
  target.setSize(width, height);
  if (target.depthTexture) target.depthTexture.image = { width, height };
}

function makeDepthTarget(renderer: THREE.WebGPURenderer): THREE.RenderTarget {
  const size = renderer.getSize(new THREE.Vector2());
  const pixelRatio = renderer.getPixelRatio();
  const width = Math.max(1, Math.floor(size.x * pixelRatio));
  const height = Math.max(1, Math.floor(size.y * pixelRatio));
  const target = new THREE.RenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  return target;
}

async function boot(): Promise<void> {
  setSmokeState({ phase: "booting" });

  if (!("gpu" in navigator)) {
    setSmokeState({ phase: "unsupported", error: "navigator.gpu is unavailable" });
    return;
  }

  const renderer = new THREE.WebGPURenderer({ canvas: smokeCanvas, antialias: true });
  await renderer.init();
  renderer.setClearColor(0x090a10, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 1.2, 6);
  camera.lookAt(0, 0.5, 0);
  camera.updateMatrixWorld(true);
  const controls = new OrbitControls(camera, smokeCanvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0.7, 0);
  controls.minDistance = 2.4;
  controls.maxDistance = 12;
  controls.update();
  const spriteTexture = await loadSpriteTexture();
  const dispersalTexture = await loadDispersalTexture();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({
      color: 0x151a20,
      transparent: true,
      opacity: 0.82,
      depthWrite: true,
      depthTest: true,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.15;
  floor.renderOrder = -10;
  scene.add(floor);

  const preset: ParticlePreset = {
    name: "webgpu-smoke",
    simulation: "gpu",
    gpu: { backend: "webgpu", maxSpawnPerFrame: 96 },
    maxParticles: 512,
    duration: 4,
    loop: true,
    prewarm: true,
    autoDispose: false,
    bounds: { radius: 8 },
    emitter: { type: "cone", radius: 0.18, angle: 18, length: 1.8 },
    emission: {
      rateOverTime: 80,
      bursts: [{ time: 0, count: 80 }],
    },
    start: {
      lifetime: [1.2, 2.4],
      speed: [0.8, 1.8],
      size: [1, 1],
      opacity: [0.7, 1],
      color: ["#7fd5ff", "#fff1ba"],
      velocity: [[-0.18, 0.15, -0.18], [0.18, 0.45, 0.18]],
      angularVelocity: [-1.2, 1.2],
    },
    forces: {
      acceleration: [0, -0.1, 0],
      drag: 0.18,
      pointAttractor: {
        center: [0.8, 2.4, 0],
        strength: 1.15,
        epsilon: 0.2,
        strengthOverLifetime: [[0, 0.35], [0.45, 1.25], [1, 0.2]],
      },
      vortex: { center: [0, 0.8, 0], axis: [0, 1, 0], orbitalSpeed: 0.95, inward: 0.12, upward: 0.08 },
      noise: { strength: 2, frequency: 1.8, scroll: [0.35, 0.5, 0.22], octaves: 3, lacunarity: 2, persistence: 0.5 },
    },
    velocityOverLifetime: {
      linear: {
        y: [[0, 0.45], [1, -0.15]],
      },
    },
    colorBySpeed: {
      speedRange: [0.4, 2.2],
      gradient: [[0, "#6f86b8"], [0.65, "#b7e7ff"], [1, "#fff0b8"]],
    },
    sizeBySpeed: {
      speedRange: [0.4, 2.2],
      curve: [[0, 0.75], [0.7, 1.05], [1, 1.35]],
    },
    rotationBySpeed: {
      speedRange: [0.4, 2.2],
      angularVelocity: [[0, -0.25], [0.7, 0.4], [1, 1.1]],
    },
    overLifetime: {
      size: [[0, 0.45], [0.25, 1.1], [1, 0.25]],
      opacity: [[0, 0.2], [0.12, 0.9], [1, 0.05]],
      color: [[0, "#ffffff"], [1, "#8ca8ff"]],
    },
    renderer: {
      type: "stretchedBillboard",
      align: "velocity",
      stretchFactor: 0.45,
      stretchMaxScale: 2.8,
      texture: spriteTexture,
      textureSheet: { columns: 2, rows: 2, animationMode: "randomStart" },
      alphaFromLuminance: { enabled: true, blackCutoff: 16 },
      dispersal: {
        strength: 1,
        texture: dispersalTexture,
        noiseScale: 5.5,
        edgeSoftness: 0.18,
        scroll: [0.04, 0.015],
        amount: [[0, 0],[0.75, 0], [1, 1]],
      },
      softParticles: true,
      softness: 1,
      blendMode: "alpha",
      depthWrite: false,
      depthTest: true,
    },
  };

  const system = new ParticleSystem(preset, { renderer });
  scene.add(system);
  system.play();
  const depthTarget = makeDepthTarget(renderer);
  system.setSoftParticleDepthTexture(depthTarget.depthTexture ?? null, { width: depthTarget.width, height: depthTarget.height });

  const clock = new THREE.Clock();
  resizeRenderer(renderer, camera);
  resizeDepthTarget(renderer, depthTarget);
  window.addEventListener("resize", () => {
    resizeRenderer(renderer, camera);
    resizeDepthTarget(renderer, depthTarget);
    system.setSoftParticleDepthTexture(depthTarget.depthTexture ?? null, { width: depthTarget.width, height: depthTarget.height });
  });

  const animate = (): void => {
    const dt = Math.min(clock.getDelta(), 1 / 30);
    controls.update();
    system.update(dt, camera);
    system.visible = false;
    renderer.setRenderTarget(depthTarget);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    system.visible = true;
    system.setSoftParticleDepthTexture(depthTarget.depthTexture ?? null, { width: depthTarget.width, height: depthTarget.height });
    renderer.render(scene, camera);
    setSmokeState({
      phase: "ready",
      backend: system.gpuBackendType,
      computeMode: system.computeMode,
      motionMode: system.motionMode,
      aliveCount: system.aliveCount,
    });
  };

  renderer.setAnimationLoop(animate);
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(error);
  setSmokeState({ phase: "error", error: message });
});
