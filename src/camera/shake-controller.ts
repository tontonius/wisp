import * as THREE from "three";
import type { CameraShakeImpulse, CameraShakeMode, CameraShakeOptions } from "./types";

const DEFAULT_SHAKE_OPTIONS: Required<CameraShakeOptions> = {
  decayRate: 1.4,
  traumaExponent: 2,
  noiseFrequency: 22,
  mode: "rotationOnly",
  maxRotation: [
    THREE.MathUtils.degToRad(1.8),
    THREE.MathUtils.degToRad(1.8),
    THREE.MathUtils.degToRad(2.4),
  ],
  maxTranslation: [0.03, 0.03, 0.03],
};

const NOISE_SEEDS: [number, number, number, number, number, number] = [11.17, 29.93, 47.81, 61.27, 79.13, 97.07];

function fract(v: number): number {
  return v - Math.floor(v);
}

function hash01(t: number, seed: number): number {
  return fract(Math.sin(t * 127.1 + seed * 311.7) * 43758.5453123);
}

function smoothstep01(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function noiseSigned(time: number, seed: number): number {
  const t0 = Math.floor(time);
  const t1 = t0 + 1;
  const alpha = smoothstep01(time - t0);
  const n0 = hash01(t0, seed);
  const n1 = hash01(t1, seed);
  return THREE.MathUtils.lerp(n0, n1, alpha) * 2 - 1;
}

function parseImpulse(impulse: CameraShakeImpulse): number {
  if (typeof impulse === "number") return impulse;
  return impulse.trauma;
}

function quaternionDifference(a: THREE.Quaternion, b: THREE.Quaternion): number {
  return 1 - Math.abs(THREE.MathUtils.clamp(a.dot(b), -1, 1));
}

/**
 * Low-level trauma shake controller for direct camera integration.
 *
 * Use this when you want shake without the `Wisp` facade.
 */
export class CameraShakeController {
  private readonly camera: THREE.Camera;

  private options: Required<CameraShakeOptions>;
  private trauma = 0;
  private noiseTime = 0;

  private readonly basePosition = new THREE.Vector3();
  private readonly baseQuaternion = new THREE.Quaternion();
  private readonly outputPosition = new THREE.Vector3();
  private readonly outputQuaternion = new THREE.Quaternion();
  private readonly offsetEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly offsetQuaternion = new THREE.Quaternion();
  private readonly translationOffset = new THREE.Vector3();

  private hasOutputState = false;

  constructor(camera: THREE.Camera, options?: CameraShakeOptions) {
    this.camera = camera;
    this.options = this.resolveOptions(options);
  }

  /** Returns current trauma in `[0, 1]`. */
  getTrauma(): number {
    return this.trauma;
  }

  /** Replaces controller options. Omitted fields fall back to defaults. */
  configure(options?: CameraShakeOptions): void {
    this.options = this.resolveOptions(options);
  }

  /** Adds trauma and clamps the total to `[0, 1]`. */
  addTrauma(amount: number): void {
    if (!Number.isFinite(amount)) return;
    this.trauma = THREE.MathUtils.clamp(this.trauma + amount, 0, 1);
  }

  /** Adds a shake impulse (`number` or `{ trauma }`). */
  shake(impulse: CameraShakeImpulse): void {
    this.addTrauma(parseImpulse(impulse));
  }

  /**
   * Advances coherent shake noise and applies offsets to the camera.
   *
   * `dt` is in seconds and values <= 0 are ignored.
   */
  update(dt: number): void {
    const safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (safeDt <= 0) return;

    if (!this.hasOutputState) {
      this.basePosition.copy(this.camera.position);
      this.baseQuaternion.copy(this.camera.quaternion);
      this.hasOutputState = true;
    } else {
      // If another system updated the camera, treat that transform as authoritative base.
      const movedSinceLastOutput = this.camera.position.distanceToSquared(this.outputPosition) > 1e-12;
      const rotatedSinceLastOutput = quaternionDifference(this.camera.quaternion, this.outputQuaternion) > 1e-12;
      if (movedSinceLastOutput || rotatedSinceLastOutput) {
        this.basePosition.copy(this.camera.position);
        this.baseQuaternion.copy(this.camera.quaternion);
      }
    }

    if (this.trauma <= 0) {
      this.camera.position.copy(this.basePosition);
      this.camera.quaternion.copy(this.baseQuaternion);
      this.outputPosition.copy(this.camera.position);
      this.outputQuaternion.copy(this.camera.quaternion);
      return;
    }

    const amplitude = Math.pow(this.trauma, this.options.traumaExponent);
    this.noiseTime += safeDt * this.options.noiseFrequency;

    const pitch = noiseSigned(this.noiseTime, NOISE_SEEDS[0]) * this.options.maxRotation[0] * amplitude;
    const yaw = noiseSigned(this.noiseTime, NOISE_SEEDS[1]) * this.options.maxRotation[1] * amplitude;
    const roll = noiseSigned(this.noiseTime, NOISE_SEEDS[2]) * this.options.maxRotation[2] * amplitude;
    this.offsetEuler.set(pitch, yaw, roll, "YXZ");

    this.offsetQuaternion.setFromEuler(this.offsetEuler);
    this.camera.quaternion.copy(this.baseQuaternion).multiply(this.offsetQuaternion);
    this.camera.position.copy(this.basePosition);

    if (this.options.mode === "rotationAndTranslation") {
      this.translationOffset.set(
        noiseSigned(this.noiseTime, NOISE_SEEDS[3]) * this.options.maxTranslation[0] * amplitude,
        noiseSigned(this.noiseTime, NOISE_SEEDS[4]) * this.options.maxTranslation[1] * amplitude,
        noiseSigned(this.noiseTime, NOISE_SEEDS[5]) * this.options.maxTranslation[2] * amplitude
      );
      this.camera.position.copy(this.basePosition).add(this.translationOffset);
    }

    this.trauma = Math.max(0, this.trauma - this.options.decayRate * safeDt);
    this.outputPosition.copy(this.camera.position);
    this.outputQuaternion.copy(this.camera.quaternion);
  }

  /** Clears trauma and forgets previous output state. */
  reset(): void {
    this.trauma = 0;
    this.hasOutputState = false;
  }

  /** Alias for `reset()` to support lifecycle cleanup patterns. */
  dispose(): void {
    this.reset();
  }

  private resolveOptions(options?: CameraShakeOptions): Required<CameraShakeOptions> {
    const mergedMode: CameraShakeMode = options?.mode ?? DEFAULT_SHAKE_OPTIONS.mode;
    return {
      decayRate: options?.decayRate ?? DEFAULT_SHAKE_OPTIONS.decayRate,
      traumaExponent: options?.traumaExponent ?? DEFAULT_SHAKE_OPTIONS.traumaExponent,
      noiseFrequency: options?.noiseFrequency ?? DEFAULT_SHAKE_OPTIONS.noiseFrequency,
      mode: mergedMode,
      maxRotation: options?.maxRotation ?? DEFAULT_SHAKE_OPTIONS.maxRotation,
      maxTranslation: options?.maxTranslation ?? DEFAULT_SHAKE_OPTIONS.maxTranslation,
    };
  }
}
