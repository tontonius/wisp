import * as THREE from "three";
import { CameraEffectsSystem } from "./camera/system";
import type { CameraEffectsOptions, CameraShakeImpulse, CameraShakeOptions } from "./camera/types";

export class WispCamera {
  private readonly system: CameraEffectsSystem;

  constructor(system: CameraEffectsSystem) {
    this.system = system;
  }

  get trauma(): number {
    return this.system.trauma;
  }

  shake(impulse: CameraShakeImpulse): this {
    this.system.shake(impulse);
    return this;
  }

  configureShake(options?: CameraShakeOptions): this {
    this.system.configureShake(options);
    return this;
  }

  update(dt: number): void {
    this.system.update(dt);
  }

  reset(): this {
    this.system.reset();
    return this;
  }
}

export class Wisp {
  readonly camera: WispCamera;
  private readonly cameraSystem: CameraEffectsSystem;

  constructor(camera: THREE.Camera, options?: CameraEffectsOptions) {
    this.cameraSystem = new CameraEffectsSystem(camera, options?.shake);
    this.camera = new WispCamera(this.cameraSystem);
  }

  update(dt: number): void {
    this.camera.update(dt);
  }

  dispose(): void {
    this.cameraSystem.dispose();
  }
}
