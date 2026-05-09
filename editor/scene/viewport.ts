import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { makeCheckerTexture } from "../lib/textures";

export type ViewportRenderer = THREE.WebGLRenderer | THREE.WebGPURenderer;
export type ViewportRendererMode = "webgl" | "webgpu";

export type ViewportBundle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: ViewportRenderer;
  rendererMode: ViewportRendererMode;
  rendererNotice?: string;
  orbitControls: OrbitControls;
  orbitTarget: THREE.Vector3;
  floor: THREE.Mesh;
  floorMaterial: THREE.MeshStandardMaterial;
  checker: THREE.Texture;
  sceneParams: {
    groundVisible: boolean;
    groundColor: string;
    backgroundColor: string;
    fogEnabled: boolean;
    fogColor: string;
    fogNearFar: { x: number; y: number };
  };
  createSceneDepthTarget: () => THREE.RenderTarget;
};

function getRequestedRendererMode(): ViewportRendererMode {
  const params = new URLSearchParams(window.location.search);
  return params.get("renderer") === "webgpu" || params.get("webgpu") === "1" ? "webgpu" : "webgl";
}

async function createRenderer(canvas: HTMLCanvasElement): Promise<{
  renderer: ViewportRenderer;
  rendererMode: ViewportRendererMode;
  rendererNotice?: string;
}> {
  if (getRequestedRendererMode() === "webgpu") {
    if ("gpu" in navigator) {
      const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
      await renderer.init();
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      return { renderer, rendererMode: "webgpu" };
    }
    return {
      renderer: new THREE.WebGLRenderer({ canvas, antialias: true }),
      rendererMode: "webgl",
      rendererNotice: "WebGPU requested but navigator.gpu is unavailable; using WebGL.",
    };
  }

  return { renderer: new THREE.WebGLRenderer({ canvas, antialias: true }), rendererMode: "webgl" };
}

export async function createViewport(canvas: HTMLCanvasElement): Promise<ViewportBundle> {
  const { renderer, rendererMode, rendererNotice } = await createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#2e2f33");
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  const orbitTarget = new THREE.Vector3(0, 0, 0);
  const orbitOffset = new THREE.Vector3(0, 2.8, 6.5).sub(orbitTarget);
  const orbit = new THREE.Spherical().setFromVector3(orbitOffset);
  const orbitOffsetTemp = new THREE.Vector3();
  camera.position.copy(orbitTarget).add(orbitOffsetTemp.setFromSpherical(orbit));
  camera.lookAt(orbitTarget);
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

  scene.add(new THREE.HemisphereLight("#cdd8ff", "#404047", 1.8));
  const key = new THREE.DirectionalLight("#ffffff", 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);

  const checker = makeCheckerTexture({ squares: 8, colorA: "#a1a1a1", colorB: "#bbbbbb" });
  checker.repeat.set(2, 2);
  const floorMaterial = new THREE.MeshStandardMaterial({ map: checker, roughness: 1, metalness: 0, color: "#6f6f6f" });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const sceneParams = {
    groundVisible: true,
    groundColor: "#6f6f6f",
    backgroundColor: "#2e2f33",
    fogEnabled: false,
    fogColor: "#2e2f33",
    fogNearFar: { x: 3, y: 18 },
  };

  function createSceneDepthTarget(): THREE.RenderTarget {
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

  return {
    scene,
    camera,
    renderer,
    rendererMode,
    rendererNotice,
    orbitControls,
    orbitTarget,
    floor,
    floorMaterial,
    checker,
    sceneParams,
    createSceneDepthTarget,
  };
}
