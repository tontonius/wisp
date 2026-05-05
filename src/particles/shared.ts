import * as THREE from "three";
import type { AlignMode, BlendMode, Curve, EmitterShape, Gradient, ParticleBounds, ParticleDebugOptions, ParticlePreset, Range, TextureSheetAnimationMode, TextureSheetConfig, Vec2Tuple, Vec3Range, Vec3Tuple, VelocityOverLifetime } from "./types";

const DEFAULT_EMITTER: EmitterShape = { type: "point" };
const DEFAULT_GIZMO_COLOR = "#78d7ff";

const tempColorA = new THREE.Color();
const tempColorB = new THREE.Color();
const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();
const tempVectorD = new THREE.Vector3();
const tempMatrixA = new THREE.Matrix4();

function randomRange(value: Range = 1): number {
  return Array.isArray(value) ? THREE.MathUtils.lerp(value[0], value[1], Math.random()) : value;
}

function rangeMinMax(value: Range | undefined, fallback: number): [number, number] {
  if (value === undefined) return [fallback, fallback];
  return Array.isArray(value) ? value : [value, value];
}

function vec3MinMax(value: Vec3Range | undefined, fallback: Vec3Tuple = [0, 0, 0]): [Vec3Tuple, Vec3Tuple] {
  if (!value) return [fallback, fallback];
  if (Array.isArray(value[0])) return value as [Vec3Tuple, Vec3Tuple];
  return [value as Vec3Tuple, value as Vec3Tuple];
}

function randomVec3(value: Vec3Range = [0, 0, 0]): THREE.Vector3 {
  if (Array.isArray(value[0])) {
    const [a, b] = value as [Vec3Tuple, Vec3Tuple];
    return new THREE.Vector3(
      THREE.MathUtils.lerp(a[0], b[0], Math.random()),
      THREE.MathUtils.lerp(a[1], b[1], Math.random()),
      THREE.MathUtils.lerp(a[2], b[2], Math.random())
    );
  }
  const v = value as Vec3Tuple;
  return new THREE.Vector3(v[0], v[1], v[2]);
}

function colorMinMax(value: THREE.ColorRepresentation | [THREE.ColorRepresentation, THREE.ColorRepresentation] | undefined): [THREE.Color, THREE.Color] {
  if (!value) return [new THREE.Color("#ffffff"), new THREE.Color("#ffffff")];
  if (Array.isArray(value)) return [new THREE.Color(value[0]), new THREE.Color(value[1])];
  const c = new THREE.Color(value);
  return [c.clone(), c.clone()];
}

function randomColor(value: THREE.ColorRepresentation | [THREE.ColorRepresentation, THREE.ColorRepresentation] = "#ffffff"): THREE.Color {
  if (Array.isArray(value)) {
    tempColorA.set(value[0]);
    tempColorB.set(value[1]);
    return tempColorA.clone().lerp(tempColorB, Math.random());
  }
  return new THREE.Color(value);
}

function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smoothstep01(x - ix);
  const fy = smoothstep01(y - iy);
  const fz = smoothstep01(z - iz);

  const c000 = hash3(ix, iy, iz);
  const c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz);
  const c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1);
  const c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1);
  const c111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = THREE.MathUtils.lerp(c000, c100, fx);
  const x10 = THREE.MathUtils.lerp(c010, c110, fx);
  const x01 = THREE.MathUtils.lerp(c001, c101, fx);
  const x11 = THREE.MathUtils.lerp(c011, c111, fx);
  const y0 = THREE.MathUtils.lerp(x00, x10, fy);
  const y1 = THREE.MathUtils.lerp(x01, x11, fy);
  return THREE.MathUtils.lerp(y0, y1, fz);
}

function fbmNoise3(
  x: number,
  y: number,
  z: number,
  octaves: number,
  lacunarity: number,
  persistence: number
): number {
  let frequency = 1;
  let amplitude = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(x * frequency, y * frequency, z * frequency) * amplitude;
    norm += amplitude;
    frequency *= lacunarity;
    amplitude *= persistence;
  }
  return norm > 0 ? sum / norm : 0;
}

function evaluateCurve(curve: Curve | undefined, t: number, fallback = 1): number {
  if (!curve || curve.length === 0) return fallback;
  if (t <= curve[0][0]) return curve[0][1];

  for (let i = 0; i < curve.length - 1; i++) {
    const [t0, v0] = curve[i];
    const [t1, v1] = curve[i + 1];
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / Math.max(0.00001, t1 - t0);
      return THREE.MathUtils.lerp(v0, v1, u);
    }
  }

  return curve[curve.length - 1][1];
}

function evaluateGradient(gradient: Gradient | undefined, t: number, target: THREE.Color): THREE.Color {
  if (!gradient || gradient.length === 0) return target.set("#ffffff");
  if (t <= gradient[0][0]) return target.set(gradient[0][1]);

  for (let i = 0; i < gradient.length - 1; i++) {
    const [t0, c0] = gradient[i];
    const [t1, c1] = gradient[i + 1];
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / Math.max(0.00001, t1 - t0);
      tempColorA.set(c0);
      tempColorB.set(c1);
      return target.copy(tempColorA).lerp(tempColorB, u);
    }
  }

  return target.set(gradient[gradient.length - 1][1]);
}

/** `t` in `[0, 1]` for sampling curves/gradients keyed 0..1 from scalar speed. */
function speedToParam(speed: number, speedRange: [number, number]): number {
  const lo = speedRange[0];
  const hi = speedRange[1];
  const span = hi - lo;
  if (Math.abs(span) < 1e-8) return 0;
  return THREE.MathUtils.clamp((speed - lo) / span, 0, 1);
}

function randomUnitVector(): THREE.Vector3 {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a));
}

function sampleEmitter(shape: EmitterShape = DEFAULT_EMITTER): { position: THREE.Vector3; direction: THREE.Vector3 } {
  switch (shape.type) {
    case "sphere": {
      const radius = shape.radius ?? 1;
      const direction = randomUnitVector();
      const distance = shape.emitFrom === "shell" ? radius : radius * Math.cbrt(Math.random());
      return { position: direction.clone().multiplyScalar(distance), direction };
    }
    case "hemisphere": {
      const radius = shape.radius ?? 1;
      const direction = randomUnitVector();
      if (direction.y < 0) direction.y *= -1;
      const distance = shape.emitFrom === "shell" ? radius : radius * Math.cbrt(Math.random());
      return { position: direction.clone().multiplyScalar(distance), direction };
    }
    case "cone": {
      const radius = shape.radius ?? 0.1;
      const angle = THREE.MathUtils.degToRad(shape.angle ?? 25);
      const length = shape.length ?? 1;
      const r = Math.sqrt(Math.random()) * radius;
      const a = Math.random() * Math.PI * 2;
      const position = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      const spread = Math.tan(angle) * length;
      const target = new THREE.Vector3((Math.random() * 2 - 1) * spread, length, (Math.random() * 2 - 1) * spread);
      return { position, direction: target.normalize() };
    }
    case "box": {
      const size = shape.size ?? [1, 1, 1];
      return {
        position: new THREE.Vector3((Math.random() - 0.5) * size[0], (Math.random() - 0.5) * size[1], (Math.random() - 0.5) * size[2]),
        direction: randomUnitVector(),
      };
    }
    case "point":
    default:
      return { position: new THREE.Vector3(), direction: randomUnitVector() };
  }
}

function makeDefaultParticleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create particle texture canvas context.");

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.8)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function applyBlendMode(material: THREE.Material, blendMode: BlendMode = "alpha"): void {
  if (blendMode === "additive") material.blending = THREE.AdditiveBlending;
  else if (blendMode === "multiply") material.blending = THREE.MultiplyBlending;
  else material.blending = THREE.NormalBlending;
}

function getTextureSheetConfig(preset: ParticlePreset): TextureSheetConfig | undefined {
  const sheet = preset.renderer?.textureSheet;
  if (!sheet) return undefined;

  const columns = Math.max(1, Math.floor(sheet.columns));
  const rows = Math.max(1, Math.floor(sheet.rows));
  const totalFrames = columns * rows;
  const mode = sheet.animationMode ?? "static";
  const randomFromMode = mode === "randomStart" || mode === "randomStartOverLifetime";
  const overLifetimeFromMode = mode === "overLifetime" || mode === "randomStartOverLifetime";
  return {
    columns,
    rows,
    totalFrames,
    frameOverLifetime: overLifetimeFromMode,
    randomFrame: randomFromMode,
  };
}

function resolveDebugOptions(debug: boolean | ParticleDebugOptions | undefined): Required<ParticleDebugOptions> {
  const options = typeof debug === "object" ? debug : {};
  const enabled = typeof debug === "boolean" ? debug : options.enabled ?? false;
  return {
    enabled,
    emitter: options.emitter ?? true,
    spawnDirection: options.spawnDirection ?? true,
    bounds: options.bounds ?? true,
    color: options.color ?? DEFAULT_GIZMO_COLOR,
    opacity: options.opacity ?? 0.85,
    segments: Math.max(8, Math.floor(options.segments ?? 48)),
  };
}

function addLine(points: THREE.Vector3[], a: THREE.Vector3, b: THREE.Vector3): void {
  points.push(a.clone(), b.clone());
}

function addCircle(points: THREE.Vector3[], radius: number, segments: number, plane: "xy" | "xz" | "yz", center = tempVectorA.set(0, 0, 0)): void {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0 = circlePoint(radius, a0, plane).add(center);
    const p1 = circlePoint(radius, a1, plane).add(center);
    addLine(points, p0, p1);
  }
}

function addArc(points: THREE.Vector3[], radius: number, segments: number, plane: "xy" | "yz"): void {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI;
    const a1 = ((i + 1) / segments) * Math.PI;
    const p0 = plane === "xy" ? new THREE.Vector3(Math.cos(a0) * radius, Math.sin(a0) * radius, 0) : new THREE.Vector3(0, Math.sin(a0) * radius, Math.cos(a0) * radius);
    const p1 = plane === "xy" ? new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius, 0) : new THREE.Vector3(0, Math.sin(a1) * radius, Math.cos(a1) * radius);
    addLine(points, p0, p1);
  }
}

function circlePoint(radius: number, angle: number, plane: "xy" | "xz" | "yz"): THREE.Vector3 {
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  if (plane === "xy") return new THREE.Vector3(x, y, 0);
  if (plane === "xz") return new THREE.Vector3(x, 0, y);
  return new THREE.Vector3(0, x, y);
}

function addArrow(points: THREE.Vector3[], from: THREE.Vector3, to: THREE.Vector3, headLength: number): void {
  addLine(points, from, to);
  const direction = tempVectorA.copy(to).sub(from).normalize();
  const right = tempVectorB.set(1, 0, 0);
  if (Math.abs(direction.dot(right)) > 0.95) right.set(0, 0, 1);
  const side = tempVectorC.copy(direction).cross(right).normalize().multiplyScalar(headLength * 0.45);
  const back = direction.multiplyScalar(-headLength);
  const headCenter = to.clone().add(back);
  addLine(points, to, headCenter.clone().add(side));
  addLine(points, to, headCenter.clone().sub(side));
}

function makeEmitterGizmo(
  shape: EmitterShape = DEFAULT_EMITTER,
  debug: boolean | ParticleDebugOptions | undefined,
  bounds?: ParticleBounds
): THREE.LineSegments {
  const options = resolveDebugOptions(debug);
  const points: THREE.Vector3[] = [];
  const segments = options.segments;

  if (options.emitter) {
    if (shape.type === "point") {
      const size = 0.18;
      addLine(points, new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0));
      addLine(points, new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0));
      addLine(points, new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size));
    } else if (shape.type === "sphere") {
      const radius = shape.radius ?? 1;
      addCircle(points, radius, segments, "xy");
      addCircle(points, radius, segments, "xz");
      addCircle(points, radius, segments, "yz");
    } else if (shape.type === "hemisphere") {
      const radius = shape.radius ?? 1;
      addCircle(points, radius, segments, "xz");
      addArc(points, radius, Math.floor(segments / 2), "xy");
      addArc(points, radius, Math.floor(segments / 2), "yz");
    } else if (shape.type === "cone") {
      const radius = shape.radius ?? 0.1;
      const length = shape.length ?? 1;
      const spread = Math.tan(THREE.MathUtils.degToRad(shape.angle ?? 25)) * length;
      const endRadius = Math.max(radius, spread);
      addCircle(points, radius, segments, "xz");
      addCircle(points, endRadius, segments, "xz", new THREE.Vector3(0, length, 0));
      const sideCount = 8;
      for (let i = 0; i < sideCount; i++) {
        const angle = (i / sideCount) * Math.PI * 2;
        addLine(points, circlePoint(radius, angle, "xz"), circlePoint(endRadius, angle, "xz").add(new THREE.Vector3(0, length, 0)));
      }
    } else if (shape.type === "box") {
      const [sx, sy, sz] = shape.size ?? [1, 1, 1];
      const x = sx * 0.5;
      const y = sy * 0.5;
      const z = sz * 0.5;
      const corners = [
        new THREE.Vector3(-x, -y, -z),
        new THREE.Vector3(x, -y, -z),
        new THREE.Vector3(x, -y, z),
        new THREE.Vector3(-x, -y, z),
        new THREE.Vector3(-x, y, -z),
        new THREE.Vector3(x, y, -z),
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(-x, y, z),
      ];
      const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const;
      for (const [a, b] of edges) addLine(points, corners[a], corners[b]);
    }
  }

  if (options.spawnDirection) {
    const length = shape.type === "cone" ? shape.length ?? 1 : shape.type === "box" ? Math.max(...(shape.size ?? [1, 1, 1])) * 0.55 : "radius" in shape ? (shape.radius ?? 1) * 1.25 : 0.45;
    addArrow(points, new THREE.Vector3(), new THREE.Vector3(0, Math.max(0.25, length), 0), Math.max(0.08, length * 0.12));
  }

  if (options.bounds && bounds) {
    const center = bounds.center ?? [0, 0, 0];
    const offset = new THREE.Vector3(center[0], center[1], center[2]);
    addCircle(points, bounds.radius, segments, "xy", offset);
    addCircle(points, bounds.radius, segments, "xz", offset);
    addCircle(points, bounds.radius, segments, "yz", offset);
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: options.color,
    transparent: true,
    opacity: options.opacity,
    depthTest: false,
  });
  const gizmo = new THREE.LineSegments(geometry, material);
  gizmo.frustumCulled = false;
  gizmo.renderOrder = 999;
  gizmo.visible = options.enabled;
  return gizmo;
}

/** Shared GLSL: noise + dissolve mask (must match GPU render fragment). */
const PARTICLE_DISPERSAL_GLSL = `
float dispersalHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float dispersalValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dispersalHash(i), dispersalHash(i + vec2(1.0, 0.0)), u.x),
    mix(dispersalHash(i + vec2(0.0, 1.0)), dispersalHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float dispersalMask(float noise, float progress, float edge) {
  float e = max(edge, 0.0001);
  float lo = progress * (1.0 + 2.0 * e) - e;
  float hi = lo + e;
  return smoothstep(lo, hi, noise);
}
`;

function makeParticleMaterial(options: NonNullable<ParticlePreset["renderer"]> = {}): THREE.ShaderMaterial {
  const softParticlesEnabled = options.softParticles ?? false;
  const dispersalEnabled = isRendererDispersalEnabled(options);
  const dispersal = options.dispersal;
  const dispersalMap = dispersal?.texture ?? null;
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: options.depthWrite ?? false,
    depthTest: options.depthTest ?? true,
    uniforms: {
      uTexture: { value: options.texture ?? makeDefaultParticleTexture() },
      uSceneDepth: { value: null },
      uSceneDepthSize: { value: new THREE.Vector2(1, 1) },
      uSoftParticles: { value: softParticlesEnabled ? 1 : 0 },
      uSoftness: { value: options.softness ?? 1.5 },
      uCameraNearFar: { value: new THREE.Vector2(0.1, 2000) },
      uCameraIsPerspective: { value: 1 },
      uDispersalEnabled: { value: dispersalEnabled ? 1 : 0 },
      uDispersalStrength: { value: dispersal?.strength ?? 1 },
      uDispersalNoiseScale: { value: dispersal?.noiseScale ?? 6 },
      uDispersalEdge: { value: dispersal?.edgeSoftness ?? 0.12 },
      uDispersalScroll: { value: new THREE.Vector2(dispersal?.scroll?.[0] ?? 0, dispersal?.scroll?.[1] ?? 0) },
      uDispersalTime: { value: 0 },
      uDispersalUseMap: { value: dispersalMap ? 1 : 0 },
      uDispersalMap: { value: dispersalMap ?? getDispersalWhitePlaceholderTexture() },
      uDispersalAmountCurve: { value: getDispersalAmountCurvePlaceholder() },
    },
    vertexShader: `
      attribute vec4 particleColor;
      attribute vec2 particleDispersal;
      varying vec2 vUv;
      varying vec4 vColor;
      varying float vAgeT;
      varying float vDispersalSeed;
      void main() {
        vUv = uv;
        vColor = particleColor;
        vAgeT = particleDispersal.x;
        vDispersalSeed = particleDispersal.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform sampler2D uSceneDepth;
      uniform vec2 uSceneDepthSize;
      uniform int uSoftParticles;
      uniform float uSoftness;
      uniform vec2 uCameraNearFar;
      uniform int uCameraIsPerspective;
      uniform int uDispersalEnabled;
      uniform float uDispersalStrength;
      uniform float uDispersalNoiseScale;
      uniform float uDispersalEdge;
      uniform vec2 uDispersalScroll;
      uniform float uDispersalTime;
      uniform int uDispersalUseMap;
      uniform sampler2D uDispersalMap;
      uniform sampler2D uDispersalAmountCurve;
      varying vec2 vUv;
      varying vec4 vColor;
      varying float vAgeT;
      varying float vDispersalSeed;
      ${PARTICLE_DISPERSAL_GLSL}

      float linearizeDepth(float depth01) {
        float near = uCameraNearFar.x;
        float far = max(near + 0.0001, uCameraNearFar.y);
        if (uCameraIsPerspective == 1) {
          float z = depth01 * 2.0 - 1.0;
          return (2.0 * near * far) / (far + near - z * (far - near));
        }
        return mix(near, far, depth01);
      }

      void main() {
        vec4 tex = texture2D(uTexture, vUv);
        vec4 outColor = tex * vColor;
        if (uSoftParticles == 1) {
          vec2 uvDepth = gl_FragCoord.xy / max(uSceneDepthSize, vec2(1.0));
          float sceneDepth01 = texture2D(uSceneDepth, uvDepth).r;
          float sceneDepth = linearizeDepth(sceneDepth01);
          float particleDepth = linearizeDepth(gl_FragCoord.z);
          float fade = clamp((sceneDepth - particleDepth) * max(0.0001, uSoftness), 0.0, 1.0);
          outColor.a *= fade;
        }
        if (uDispersalEnabled == 1) {
          vec2 scroll = uDispersalScroll * uDispersalTime;
          vec2 dUv = vUv * uDispersalNoiseScale + vec2(vDispersalSeed * 17.413, vDispersalSeed * 63.291) + scroll;
          float n = uDispersalUseMap == 1 ? texture2D(uDispersalMap, dUv).r : dispersalValueNoise(dUv);
          float amount = texture2D(uDispersalAmountCurve, vec2(clamp(vAgeT, 0.0, 1.0), 0.5)).r;
          float m = dispersalMask(n, amount, uDispersalEdge);
          outColor.a *= mix(1.0, m, clamp(uDispersalStrength, 0.0, 1.0));
        }
        if (outColor.a < 0.001) discard;
        gl_FragColor = outColor;
      }
    `,
  });

  applyBlendMode(material, options.blendMode ?? "alpha");
  return material;
}

function isRendererDispersalEnabled(renderer: ParticlePreset["renderer"] | undefined): boolean {
  const d = renderer?.dispersal;
  if (!d) return false;
  return d.enabled !== false;
}

/** Normalized-age → dissolve amount (`0`..`1`). Without a curve, samples the identity ramp. */
function makeDispersalAmountCurveTexture(curve: Curve | undefined): THREE.DataTexture {
  const width = 256;
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const v = curve ? THREE.MathUtils.clamp(evaluateCurve(curve, t, t), 0, 1) : t;
    const b = Math.round(v * 255);
    data[i * 4 + 0] = b;
    data[i * 4 + 1] = b;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

let dispersalAmountCurvePlaceholder: THREE.DataTexture | undefined;
function getDispersalAmountCurvePlaceholder(): THREE.DataTexture {
  if (!dispersalAmountCurvePlaceholder) dispersalAmountCurvePlaceholder = makeDispersalAmountCurveTexture(undefined);
  return dispersalAmountCurvePlaceholder;
}

let dispersalWhitePlaceholder: THREE.DataTexture | undefined;
function getDispersalWhitePlaceholderTexture(): THREE.DataTexture {
  if (!dispersalWhitePlaceholder) {
    const d = new Uint8Array([255, 255, 255, 255]);
    dispersalWhitePlaceholder = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    dispersalWhitePlaceholder.needsUpdate = true;
    dispersalWhitePlaceholder.magFilter = THREE.LinearFilter;
    dispersalWhitePlaceholder.minFilter = THREE.LinearFilter;
    dispersalWhitePlaceholder.wrapS = THREE.RepeatWrapping;
    dispersalWhitePlaceholder.wrapT = THREE.RepeatWrapping;
  }
  return dispersalWhitePlaceholder;
}

function makeCurveTexture(curve: Curve | undefined, fallback = 1): THREE.DataTexture {
  const width = 256;
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const v = THREE.MathUtils.clamp(evaluateCurve(curve, t, fallback), 0, 1);
    const b = Math.round(v * 255);
    data[i * 4 + 0] = b;
    data[i * 4 + 1] = b;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** 1×256 float ramp for arbitrary scalar curves (e.g. size or angular velocity vs normalized speed). */
function makeCurveFloatTexture(curve: Curve | undefined, fallback = 1): THREE.DataTexture {
  const width = 256;
  const data = new Float32Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const v = evaluateCurve(curve, t, fallback);
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 1;
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function makeGradientTexture(gradient: Gradient | undefined): THREE.DataTexture {
  const width = 256;
  const data = new Uint8Array(width * 4);
  const color = new THREE.Color();
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    evaluateGradient(gradient, t, color);
    data[i * 4 + 0] = Math.round(THREE.MathUtils.clamp(color.r, 0, 1) * 255);
    data[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(color.g, 0, 1) * 255);
    data[i * 4 + 2] = Math.round(THREE.MathUtils.clamp(color.b, 0, 1) * 255);
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeVectorCurveTexture(velocity: VelocityOverLifetime | undefined): THREE.DataTexture {
  const width = 256;
  const data = new Float32Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    data[i * 4 + 0] = evaluateCurve(velocity?.linear?.x, t, 0);
    data[i * 4 + 1] = evaluateCurve(velocity?.linear?.y, t, 0);
    data[i * 4 + 2] = evaluateCurve(velocity?.linear?.z, t, 0);
    data[i * 4 + 3] = 1;
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export {
  DEFAULT_EMITTER,
  applyBlendMode,
  colorMinMax,
  evaluateCurve,
  evaluateGradient,
  fbmNoise3,
  getDispersalAmountCurvePlaceholder,
  getDispersalWhitePlaceholderTexture,
  getTextureSheetConfig,
  isRendererDispersalEnabled,
  makeCurveFloatTexture,
  makeCurveTexture,
  makeDefaultParticleTexture,
  makeDispersalAmountCurveTexture,
  makeEmitterGizmo,
  makeGradientTexture,
  makeParticleMaterial,
  makeVectorCurveTexture,
  randomColor,
  randomRange,
  randomVec3,
  rangeMinMax,
  resolveDebugOptions,
  sampleEmitter,
  speedToParam,
  tempColorA,
  tempColorB,
  tempMatrixA,
  tempVectorA,
  tempVectorB,
  tempVectorC,
  tempVectorD,
  vec3MinMax,
  PARTICLE_DISPERSAL_GLSL,
};
