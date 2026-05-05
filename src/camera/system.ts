import * as THREE from "three";
import { CameraShakeController } from "./shake-controller";
import type { CameraShakeImpulse, CameraShakeOptions } from "./types";

/** High-level camera-effects wrapper currently focused on trauma-based shake. */
export class CameraEffectsSystem {
  readonly shakeController: CameraShakeController;

  constructor(camera: THREE.Camera, options?: CameraShakeOptions) {
    this.shakeController = new CameraShakeController(camera, options);
  }

  /** Current trauma amount in `[0, 1]`. */
  get trauma(): number {
    return this.shakeController.getTrauma();
  }

  /** Adds a shake impulse (number or `{ trauma }`). */
  shake(impulse: CameraShakeImpulse): this {
    this.shakeController.shake(impulse);
    return this;
  }

  /** Replaces shake tuning options at runtime. */
  configureShake(options?: CameraShakeOptions): this {
    this.shakeController.configure(options);
    return this;
  }

  /** Advances camera effects by `dt` seconds. */
  update(dt: number): void {
    this.shakeController.update(dt);
  }

  /** Clears trauma and resets shake baseline state. */
  reset(): this {
    this.shakeController.reset();
    return this;
  }

  /** Disposes camera-effects state. */
  dispose(): void {
    this.shakeController.dispose();
  }
}
