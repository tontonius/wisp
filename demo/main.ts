import * as THREE from "three";
import { ParticlePreset, ParticleWorld } from "../src";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0b1020");

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4.2, 8);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight("#ffffff", 2.5);
light.position.set(4, 8, 5);
scene.add(light);
scene.add(new THREE.AmbientLight("#7788aa", 1.5));

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.MeshStandardMaterial({ color: "#182033", roughness: 0.85, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(16, 16, "#3d4a66", "#253047");
scene.add(grid);

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
const spark = makeSparkTexture();

const muzzleFlash: ParticlePreset = {
  maxParticles: 40,
  duration: 0.12,
  emitter: { type: "cone", radius: 0.03, angle: 14, length: 1 },
  emission: { bursts: [{ time: 0, count: [10, 18] }] },
  start: {
    lifetime: [0.035, 0.1],
    speed: [3, 7],
    size: [0.08, 0.24],
    color: ["#fff7cc", "#ff8a22"],
    opacity: 1,
    rotation: [0, Math.PI * 2],
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
  forces: { gravity: [0, 0.25, 0], drag: 1.35, noise: { strength: 0.5, frequency: 4 } },
  overLifetime: {
    size: [[0, 0.15], [0.25, 1], [1, 1.9]],
    opacity: [[0, 0], [0.14, 1], [1, 0]],
    color: [[0, "#aaaaaa"], [1, "#252832"]],
  },
  renderer: { texture: softDisc, blendMode: "alpha", depthWrite: false },
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
  forces: { gravity: [0, -1.8, 0], drag: 2.2, noise: { strength: 0.25, frequency: 7 } },
  overLifetime: {
    size: [[0, 1], [0.4, 0.7], [1, 0]],
    opacity: [[0, 1], [1, 0]],
    color: [[0, "#ffffff"], [0.22, "#ffcc33"], [0.6, "#ff4422"], [1, "#333333"]],
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

const particles = new ParticleWorld(scene, { muzzleFlash, smokePuff, magicAura, explosion, gpuMagicStorm }, { renderer });
particles.spawn("magicAura", { position: [-2.2, 0.2, 0] });
particles.spawn("gpuMagicStorm", { position: [1.2, 0.3, 0] });

const ui = document.createElement("div");
ui.className = "ui";
ui.innerHTML = `
  <h1>Three Particles MVP</h1>
  <p>Click to spawn explosion + smoke. Press <b>1</b> muzzle flash, <b>2</b> smoke, <b>3</b> explosion, <b>4</b> GPU storm burst.</p>
`;
document.body.appendChild(ui);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

function spawnAtPointer(event: PointerEvent, kind = "explosion") {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(groundPlane, hit);

  if (kind === "explosion") {
    particles.spawn("explosion", { position: hit });
    particles.spawn("smokePuff", { position: hit.clone().add(new THREE.Vector3(0, 0.15, 0)) });
  } else {
    particles.spawn(kind, { position: hit });
  }
}

window.addEventListener("pointerdown", (event) => spawnAtPointer(event, "explosion"));
window.addEventListener("keydown", (event) => {
  if (event.key === "1") particles.spawn("muzzleFlash", { position: [-2, 1, 0] });
  if (event.key === "2") particles.spawn("smokePuff", { position: [0, 0, 0] });
  if (event.key === "3") particles.spawn("explosion", { position: [2, 0, 0] });
  if (event.key === "4") particles.spawn("gpuMagicStorm", { position: [1.2, 0.3, 0] }).emit(1500);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  particles.update(dt, camera);
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
