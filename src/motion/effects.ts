import * as THREE from "three";
import type {
  MotionBreatheOptions,
  MotionEffectInstance,
  MotionHoverOptions,
  MotionLeanByVelocityOptions,
  MotionPopOptions,
  MotionRecoilOptions,
  MotionSquashOptions,
  MotionUpdateContext,
  MotionVectorSource,
} from "./types";

const DEFAULT_UP = new THREE.Vector3(0, 1, 0);
const DEFAULT_FORWARD = new THREE.Vector3(0, 0, 1);
const EPSILON = 1e-6;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

class PopEffect implements MotionEffectInstance {
  readonly phase = "oneshot" as const;
  readonly id: number;
  done = false;
  private readonly duration: number;
  private readonly strength: number;
  private elapsed = 0;
  private readonly scale = new THREE.Vector3(1, 1, 1);

  constructor(id: number, options: MotionPopOptions = {}) {
    this.id = id;
    this.duration = Math.max(0.001, options.duration ?? 0.18);
    this.strength = Math.max(0, options.strength ?? 0.22);
  }

  update(context: MotionUpdateContext) {
    this.elapsed += context.dt;
    const t = clamp01(this.elapsed / this.duration);
    const envelope = Math.sin(Math.PI * t);
    const factor = 1 + envelope * this.strength;
    this.scale.set(factor, factor, factor);
    this.done = t >= 1;
    return { scale: this.scale };
  }
}

class SquashEffect implements MotionEffectInstance {
  readonly phase = "oneshot" as const;
  readonly id: number;
  done = false;
  private readonly duration: number;
  private readonly amount: number;
  private elapsed = 0;
  private readonly scale = new THREE.Vector3(1, 1, 1);

  constructor(id: number, options: MotionSquashOptions = {}) {
    this.id = id;
    this.duration = Math.max(0.001, options.duration ?? 0.22);
    this.amount = Math.max(0, options.amount ?? 0.2);
  }

  update(context: MotionUpdateContext) {
    this.elapsed += context.dt;
    const t = clamp01(this.elapsed / this.duration);
    const envelope = Math.sin(Math.PI * t);
    const squash = envelope * this.amount;
    const side = 1 + squash * 0.5;
    const vertical = Math.max(0.1, 1 - squash);
    this.scale.set(side, vertical, side);
    this.done = t >= 1;
    return { scale: this.scale };
  }
}

class RecoilEffect implements MotionEffectInstance {
  readonly phase = "impulse" as const;
  readonly id: number;
  done = false;
  private readonly direction = new THREE.Vector3();
  private readonly distance: number;
  private readonly maxRotation: number;
  private readonly duration: number;
  private elapsed = 0;
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();

  constructor(id: number, direction: THREE.Vector3, options: MotionRecoilOptions = {}) {
    this.id = id;
    this.direction.copy(direction);
    if (this.direction.lengthSq() <= EPSILON) {
      this.direction.copy(DEFAULT_FORWARD);
    } else {
      this.direction.normalize();
    }
    this.duration = Math.max(0.001, options.duration ?? 0.16);
    this.distance = Math.max(0, options.distance ?? 0.2);
    this.maxRotation = THREE.MathUtils.degToRad(Math.max(0, options.rotation ?? 11.5));
  }

  update(context: MotionUpdateContext) {
    this.elapsed += context.dt;
    const t = clamp01(this.elapsed / this.duration);
    const envelope = Math.sin(Math.PI * t);
    this.position.copy(this.direction).multiplyScalar(-this.distance * envelope);

    this.axis.crossVectors(this.direction, DEFAULT_UP);
    if (this.axis.lengthSq() <= EPSILON) {
      this.axis.set(1, 0, 0);
    } else {
      this.axis.normalize();
    }
    this.rotation.setFromAxisAngle(this.axis, this.maxRotation * envelope);
    this.done = t >= 1;
    return { position: this.position, rotation: this.rotation };
  }
}

class HoverEffect implements MotionEffectInstance {
  readonly phase = "persistent" as const;
  readonly id: number;
  done = false;
  private readonly amplitude: number;
  private readonly frequency: number;
  private readonly position = new THREE.Vector3();

  constructor(id: number, options: MotionHoverOptions = {}) {
    this.id = id;
    this.amplitude = options.amplitude ?? 0.08;
    this.frequency = options.frequency ?? 1.6;
  }

  update(context: MotionUpdateContext) {
    const y = Math.sin(context.elapsed * Math.PI * 2 * this.frequency) * this.amplitude;
    this.position.set(0, y, 0);
    return { position: this.position };
  }
}

class BreatheEffect implements MotionEffectInstance {
  readonly phase = "persistent" as const;
  readonly id: number;
  done = false;
  private readonly amplitude: number;
  private readonly frequency: number;
  private readonly scale = new THREE.Vector3(1, 1, 1);

  constructor(id: number, options: MotionBreatheOptions = {}) {
    this.id = id;
    this.amplitude = options.amplitude ?? 0.05;
    this.frequency = options.frequency ?? 0.8;
  }

  update(context: MotionUpdateContext) {
    const pulse = 1 + Math.sin(context.elapsed * Math.PI * 2 * this.frequency) * this.amplitude;
    this.scale.set(pulse, pulse, pulse);
    return { scale: this.scale };
  }
}

class LeanByVelocityEffect implements MotionEffectInstance {
  readonly phase = "response" as const;
  readonly id: number;
  done = false;
  private readonly source: MotionVectorSource;
  private readonly maxAngle: number;
  private readonly response: number;
  private readonly rotation = new THREE.Quaternion();
  private readonly tempEuler = new THREE.Euler();
  private readonly sampledVelocity = new THREE.Vector3();
  private smoothPitch = 0;
  private smoothRoll = 0;

  constructor(id: number, source: MotionVectorSource, options: MotionLeanByVelocityOptions = {}) {
    this.id = id;
    this.source = source;
    this.maxAngle = THREE.MathUtils.degToRad(Math.max(0, options.maxAngle ?? 20));
    this.response = Math.max(0.001, options.response ?? 10);
  }

  update(context: MotionUpdateContext) {
    const value = this.source();
    if (Array.isArray(value)) {
      this.sampledVelocity.set(value[0], value[1], value[2]);
    } else {
      this.sampledVelocity.copy(value);
    }
    const velocity = this.sampledVelocity;
    const horizontalSpeed = Math.max(EPSILON, Math.hypot(velocity.x, velocity.z));
    const targetPitch = THREE.MathUtils.clamp(-velocity.z / horizontalSpeed, -1, 1) * this.maxAngle;
    const targetRoll = THREE.MathUtils.clamp(-velocity.x / horizontalSpeed, -1, 1) * this.maxAngle;
    const alpha = 1 - Math.exp(-context.dt * this.response);
    this.smoothPitch = THREE.MathUtils.lerp(this.smoothPitch, targetPitch, alpha);
    this.smoothRoll = THREE.MathUtils.lerp(this.smoothRoll, targetRoll, alpha);
    this.tempEuler.set(this.smoothPitch, 0, this.smoothRoll, "XYZ");
    this.rotation.setFromEuler(this.tempEuler);
    return { rotation: this.rotation };
  }
}

export function createPopEffect(id: number, options?: MotionPopOptions): MotionEffectInstance {
  return new PopEffect(id, options);
}

export function createSquashEffect(id: number, options?: MotionSquashOptions): MotionEffectInstance {
  return new SquashEffect(id, options);
}

export function createRecoilEffect(
  id: number,
  direction: THREE.Vector3,
  options?: MotionRecoilOptions
): MotionEffectInstance {
  return new RecoilEffect(id, direction, options);
}

export function createHoverEffect(id: number, options?: MotionHoverOptions): MotionEffectInstance {
  return new HoverEffect(id, options);
}

export function createBreatheEffect(id: number, options?: MotionBreatheOptions): MotionEffectInstance {
  return new BreatheEffect(id, options);
}

export function createLeanByVelocityEffect(
  id: number,
  source: MotionVectorSource,
  options?: MotionLeanByVelocityOptions
): MotionEffectInstance {
  return new LeanByVelocityEffect(id, source, options);
}
