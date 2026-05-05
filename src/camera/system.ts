import * as THREE from "three";
import { CameraShakeController } from "./shake-controller";
import type { CameraShakeImpulse, CameraShakeOptions } from "./types";

export class CameraEffectsSystem {
  readonly shakeController: CameraShakeController;

  constructor(camera: THREE.Camera, options?: CameraShakeOptions) {
    this.shakeController = new CameraShakeController(camera, options);
  }

  get trauma(): number {
    return this.shakeController.getTrauma();
  }

  shake(impulse: CameraShakeImpulse): this {
    this.shakeController.shake(impulse);
    return this;
  }

  configureShake(options?: CameraShakeOptions): this {
    this.shakeController.configure(options);
    return this;
  }

  update(dt: number): void {
    this.shakeController.update(dt);
  }

  reset(): this {
    this.shakeController.reset();
    return this;
  }

  dispose(): void {
    this.shakeController.dispose();
  }
}
