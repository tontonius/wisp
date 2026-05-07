import * as THREE from "three";
import { MotionController } from "./controller";
import type {
  MotionBreatheOptions,
  MotionControllerOptions,
  MotionHoverOptions,
  MotionLeanByVelocityOptions,
  MotionPopOptions,
  MotionRecoilOptions,
  MotionSquashOptions,
  MotionVectorSource,
} from "./types";

/** Fluent facade for per-object motion effects. */
export class MotionHandle {
  private readonly controller: MotionController;

  constructor(controller: MotionController) {
    this.controller = controller;
  }

  pop(options?: MotionPopOptions): this {
    this.controller.pop(options);
    return this;
  }

  squash(options?: MotionSquashOptions): this {
    this.controller.squash(options);
    return this;
  }

  recoil(direction: THREE.Vector3, options?: MotionRecoilOptions): this {
    this.controller.recoil(direction, options);
    return this;
  }

  hover(options?: MotionHoverOptions): this {
    this.controller.hover(options);
    return this;
  }

  breathe(options?: MotionBreatheOptions): this {
    this.controller.breathe(options);
    return this;
  }

  leanByVelocity(source: MotionVectorSource, options?: MotionLeanByVelocityOptions): this {
    this.controller.leanByVelocity(source, options);
    return this;
  }

  clearEffects(): this {
    this.controller.clearEffects();
    return this;
  }
}

/** Runtime manager for additive visual transform offsets. */
export class MotionEffectsSystem {
  private readonly options: MotionControllerOptions;
  private readonly controllers = new Map<THREE.Object3D, MotionController>();

  constructor(options: MotionControllerOptions = {}) {
    this.options = options;
  }

  motion(target: THREE.Object3D): MotionHandle {
    const existing = this.controllers.get(target);
    if (existing) {
      return new MotionHandle(existing);
    }
    const controller = new MotionController(target, this.options);
    this.controllers.set(target, controller);
    return new MotionHandle(controller);
  }

  release(target: THREE.Object3D): void {
    const controller = this.controllers.get(target);
    if (!controller) {
      return;
    }
    controller.reset();
    this.controllers.delete(target);
  }

  update(dt: number): void {
    for (const controller of this.controllers.values()) {
      controller.update(dt);
    }
  }

  clear(): void {
    for (const controller of this.controllers.values()) {
      controller.reset();
    }
    this.controllers.clear();
  }

  get size(): number {
    return this.controllers.size;
  }
}
