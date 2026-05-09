import * as THREE from "three/webgpu";
import {
  Fn,
  cos,
  float,
  instanceIndex,
  instancedArray,
  max,
  positionGeometry,
  sin,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import "./style.css";

type SpikeState = {
  phase: "booting" | "unsupported" | "ready" | "error";
  mode?: string;
  visible?: string;
  error?: string;
};

type StorageNode = {
  value: THREE.BufferAttribute;
  element: (index: unknown) => any;
  toAttribute: () => any;
};

declare global {
  interface Window {
    __WISP_WEBGPU_TSL_SPIKE__?: SpikeState;
  }
}

const root = document.querySelector<HTMLElement>("#webgpu-tsl-spike");
const canvas = document.querySelector<HTMLCanvasElement>("#webgpu-tsl-spike-canvas");
const phaseEl = document.querySelector<HTMLElement>('[data-status="phase"]');
const modeEl = document.querySelector<HTMLElement>('[data-status="mode"]');
const visibleEl = document.querySelector<HTMLElement>('[data-status="visible"]');
const errorEl = document.querySelector<HTMLElement>('[data-status="error"]');

if (!root || !canvas || !phaseEl || !modeEl || !visibleEl || !errorEl) {
  throw new Error("WebGPU TSL spike markup is missing.");
}

function setSpikeState(next: SpikeState): void {
  window.__WISP_WEBGPU_TSL_SPIKE__ = next;
  root.dataset.phase = next.phase;
  phaseEl.textContent = next.phase;
  modeEl.textContent = `mode: ${next.mode ?? "unknown"}`;
  visibleEl.textContent = `visible: ${next.visible ?? "unknown"}`;
  errorEl.textContent = next.error ?? "";
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

async function boot(): Promise<void> {
  setSpikeState({ phase: "booting" });

  if (!("gpu" in navigator)) {
    setSpikeState({ phase: "unsupported", error: "navigator.gpu is unavailable" });
    return;
  }

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  renderer.setClearColor(0x090a10, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0.6, 7);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  const referenceMaterial = new THREE.MeshBasicNodeMaterial({ color: "#22ffbb" });
  const reference = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), referenceMaterial);
  reference.position.set(-3, -1.8, 0);
  scene.add(reference);

  const count = 48;
  const positionData = new Float32Array(count * 4);
  const stateData = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const column = i % 8;
    const row = Math.floor(i / 8);
    const offset = i * 4;
    positionData[offset + 0] = (column - 3.5) * 0.62;
    positionData[offset + 1] = (row - 2.5) * 0.62;
    positionData[offset + 2] = 0;
    positionData[offset + 3] = i / count;
    stateData[offset + 0] = 1;
    stateData[offset + 1] = 0.28 + (i % 4) * 0.05;
    stateData[offset + 2] = i * 0.18;
    stateData[offset + 3] = 0.6 + (i % 5) * 0.18;
  }

  const positionNode = instancedArray(positionData, "vec4") as StorageNode;
  const stateNode = instancedArray(stateData, "vec4") as StorageNode;
  const dtUniform = uniform(0);

  const computeNode = Fn(() => {
    const index = instanceIndex;
    const position = positionNode.element(index).toVar();
    const state = stateNode.element(index).toVar();
    const phase = position.w.add(dtUniform.mul(state.w)).toVar();

    position.w.assign(phase);
    position.y.addAssign(sin(phase.mul(6.28318)).mul(0.01));
    state.z.addAssign(dtUniform.mul(state.w));

    positionNode.element(index).assign(position);
    stateNode.element(index).assign(state);
  })().compute(count, [64]).setName("Wisp TSL Billboard Spike");

  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const positionAttribute = positionNode.toAttribute().setInstanced(true);
  const stateAttribute = stateNode.toAttribute().setInstanced(true);
  const activeSize = stateAttribute.x.mul(stateAttribute.y);
  const rotationCos = cos(stateAttribute.z);
  const rotationSin = sin(stateAttribute.z);
  const localPosition = positionGeometry as any;
  const rotatedX = localPosition.x.mul(rotationCos).sub(localPosition.y.mul(rotationSin)).mul(activeSize);
  const rotatedY = localPosition.x.mul(rotationSin).add(localPosition.y.mul(rotationCos)).mul(activeSize);

  material.positionNode = positionAttribute.xyz.add(vec3(rotatedX, rotatedY, 0));
  material.colorNode = vec4(0.22, 0.85, 1, max(float(0.25), stateAttribute.x));

  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, count);
  mesh.frustumCulled = false;
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, new THREE.Matrix4());
  scene.add(mesh);

  const clock = new THREE.Clock();
  resizeRenderer(renderer, camera);
  window.addEventListener("resize", () => resizeRenderer(renderer, camera));

  const animate = (): void => {
    const dt = Math.min(clock.getDelta(), 1 / 30);
    dtUniform.value = dt;
    positionNode.value.needsUpdate = true;
    stateNode.value.needsUpdate = true;
    void renderer.compute(computeNode, count);
    renderer.render(scene, camera);
    setSpikeState({
      phase: "ready",
      mode: "storage attribute positionNode",
      visible: "expect cyan billboard grid",
    });
  };

  renderer.setAnimationLoop(animate);
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(error);
  setSpikeState({ phase: "error", error: message });
});
