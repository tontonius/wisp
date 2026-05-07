import * as THREE from "three";

/** Categorizes when an effect should compose in the stack. */
export type MotionEffectPhase = "persistent" | "response" | "impulse" | "oneshot";

/** Optional channel offsets produced by a motion effect. */
export interface MotionOffset {
  position?: THREE.Vector3;
  rotation?: THREE.Quaternion;
  scale?: THREE.Vector3;
}

/** Immutable frame data passed to effect evaluators. */
export interface MotionUpdateContext {
  dt: number;
  elapsed: number;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Quaternion;
  baseScale: THREE.Vector3;
  baseVelocity: THREE.Vector3;
}

/** Internal state contract for active effects. */
export interface MotionEffectInstance {
  readonly id: number;
  readonly phase: MotionEffectPhase;
  update(context: MotionUpdateContext): MotionOffset | undefined;
  readonly done: boolean;
}

/** Optional controller behavior tuning. */
export interface MotionControllerOptions {
  /** Maximum simulation step in seconds. Large dt spikes are clamped. Default `1 / 20`. */
  maxDt?: number;
}

/** Source callback for velocity-reactive effects. */
export type MotionVectorSource = () => THREE.Vector3 | [number, number, number];

/** Options for one-shot pop scale impulse. */
export interface MotionPopOptions {
  duration?: number;
  strength?: number;
}

/** Options for one-shot squash/stretch impulse. */
export interface MotionSquashOptions {
  duration?: number;
  amount?: number;
}

/** Options for recoil impulse. */
export interface MotionRecoilOptions {
  duration?: number;
  distance?: number;
  rotation?: number;
}

/** Options for looping hover motion. */
export interface MotionHoverOptions {
  amplitude?: number;
  frequency?: number;
}

/** Options for velocity-driven lean. */
export interface MotionLeanByVelocityOptions {
  maxAngle?: number;
  response?: number;
}

/** Options for looping breathe scale effect. */
export interface MotionBreatheOptions {
  amplitude?: number;
  frequency?: number;
}

/** Top-level motion module options used by `WispOptions.motion`. */
export interface WispMotionOptions extends MotionControllerOptions {}
