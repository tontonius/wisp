import * as THREE from "three";
import {
  createBreatheEffect,
  createHoverEffect,
  createLeanByVelocityEffect,
  createPopEffect,
  createRecoilEffect,
  createSquashEffect,
} from "./effects";
import type {
  MotionBreatheOptions,
  MotionControllerOptions,
  MotionEffectInstance,
  MotionHoverOptions,
  MotionLeanByVelocityOptions,
  MotionOffset,
  MotionPopOptions,
  MotionRecoilOptions,
  MotionSquashOptions,
  MotionUpdateContext,
  MotionVectorSource,
} from "./types";

const IDENTITY_SCALE = new THREE.Vector3(1, 1, 1);
const PHASE_ORDER = {
  persistent: 0,
  response: 1,
  impulse: 2,
  oneshot: 3,
} as const;

function clampDt(dt: number, maxDt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) {
    return 0;
  }
  return Math.min(dt, maxDt);
}

export class MotionController {
  readonly target: THREE.Object3D;
  private readonly maxDt: number;
  private effects: MotionEffectInstance[] = [];
  private nextEffectId = 1;
  private elapsed = 0;

  private readonly lastPositionOffset = new THREE.Vector3();
  private readonly lastRotationOffset = new THREE.Quaternion();
  private readonly lastRotationInverse = new THREE.Quaternion();
  private readonly lastScaleMultiplier = new THREE.Vector3(1, 1, 1);

  private readonly basePosition = new THREE.Vector3();
  private readonly baseRotation = new THREE.Quaternion();
  private readonly baseScale = new THREE.Vector3(1, 1, 1);
  private readonly previousBasePosition = new THREE.Vector3();
  private readonly baseVelocity = new THREE.Vector3();
  private hasPreviousBase = false;

  private readonly accumulatedPosition = new THREE.Vector3();
  private readonly accumulatedRotation = new THREE.Quaternion();
  private readonly accumulatedScale = new THREE.Vector3(1, 1, 1);

  constructor(target: THREE.Object3D, options: MotionControllerOptions = {}) {
    this.target = target;
    this.maxDt = Math.max(0.001, options.maxDt ?? 1 / 20);
    this.lastRotationOffset.identity();
    this.lastRotationInverse.identity();
  }

  pop(options?: MotionPopOptions): this {
    this.effects.push(createPopEffect(this.nextEffectId++, options));
    return this;
  }

  squash(options?: MotionSquashOptions): this {
    this.effects.push(createSquashEffect(this.nextEffectId++, options));
    return this;
  }

  recoil(direction: THREE.Vector3, options?: MotionRecoilOptions): this {
    this.effects.push(createRecoilEffect(this.nextEffectId++, direction, options));
    return this;
  }

  hover(options?: MotionHoverOptions): this {
    this.effects.push(createHoverEffect(this.nextEffectId++, options));
    return this;
  }

  breathe(options?: MotionBreatheOptions): this {
    this.effects.push(createBreatheEffect(this.nextEffectId++, options));
    return this;
  }

  leanByVelocity(source: MotionVectorSource, options?: MotionLeanByVelocityOptions): this {
    this.effects.push(createLeanByVelocityEffect(this.nextEffectId++, source, options));
    return this;
  }

  clearEffects(): this {
    this.effects = [];
    return this;
  }

  update(dt: number): void {
    const step = clampDt(dt, this.maxDt);
    this.removeLastOffset();
    this.readBaseTransform(step);

    if (step <= 0) {
      this.storeLastOffsetAsIdentity();
      return;
    }

    this.elapsed += step;
    this.accumulatedPosition.set(0, 0, 0);
    this.accumulatedRotation.identity();
    this.accumulatedScale.set(1, 1, 1);

    const context: MotionUpdateContext = {
      dt: step,
      elapsed: this.elapsed,
      basePosition: this.basePosition,
      baseRotation: this.baseRotation,
      baseScale: this.baseScale,
      baseVelocity: this.baseVelocity,
    };

    this.effects.sort((a, b) => {
      if (a.phase === b.phase) {
        return a.id - b.id;
      }
      return PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
    });

    const active: MotionEffectInstance[] = [];
    for (const effect of this.effects) {
      const offset = effect.update(context);
      this.compose(offset);
      if (!effect.done) {
        active.push(effect);
      }
    }
    this.effects = active;

    this.applyAccumulatedOffset();
  }

  reset(): void {
    this.removeLastOffset();
    this.storeLastOffsetAsIdentity();
    this.effects = [];
    this.hasPreviousBase = false;
    this.baseVelocity.set(0, 0, 0);
  }

  private removeLastOffset(): void {
    this.target.position.sub(this.lastPositionOffset);
    this.lastRotationInverse.copy(this.lastRotationOffset).invert();
    this.target.quaternion.multiply(this.lastRotationInverse);
    this.target.scale.divide(this.lastScaleMultiplier);
  }

  private readBaseTransform(dt: number): void {
    this.basePosition.copy(this.target.position);
    this.baseRotation.copy(this.target.quaternion);
    this.baseScale.copy(this.target.scale);

    if (dt <= 0 || !this.hasPreviousBase) {
      this.baseVelocity.set(0, 0, 0);
      this.previousBasePosition.copy(this.basePosition);
      this.hasPreviousBase = true;
      return;
    }

    this.baseVelocity.copy(this.basePosition).sub(this.previousBasePosition).multiplyScalar(1 / dt);
    this.previousBasePosition.copy(this.basePosition);
  }

  private compose(offset: MotionOffset | undefined): void {
    if (!offset) {
      return;
    }
    if (offset.position) {
      this.accumulatedPosition.add(offset.position);
    }
    if (offset.rotation) {
      this.accumulatedRotation.multiply(offset.rotation);
    }
    if (offset.scale) {
      this.accumulatedScale.multiply(offset.scale);
    }
  }

  private applyAccumulatedOffset(): void {
    this.target.position.add(this.accumulatedPosition);
    this.target.quaternion.multiply(this.accumulatedRotation);
    this.target.scale.multiply(this.accumulatedScale);
    this.lastPositionOffset.copy(this.accumulatedPosition);
    this.lastRotationOffset.copy(this.accumulatedRotation);
    this.lastScaleMultiplier.copy(this.accumulatedScale);
  }

  private storeLastOffsetAsIdentity(): void {
    this.lastPositionOffset.set(0, 0, 0);
    this.lastRotationOffset.identity();
    this.lastScaleMultiplier.copy(IDENTITY_SCALE);
  }
}
