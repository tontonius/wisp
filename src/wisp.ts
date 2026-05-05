import * as THREE from "three";
import { CameraEffectsSystem } from "./camera/system";
import type { CameraEffectsOptions, CameraShakeImpulse, CameraShakeOptions } from "./camera/types";
import type { ParticleSystem } from "./particles/system";
import { ParticleWorld } from "./particles/world";
import type { ParticleDebugOptions, ParticlePreset, ParticleSpawnOptions, ParticleWorldOptions } from "./particles/types";

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

export class WispParticles {
  private readonly world: ParticleWorld;

  constructor(world: ParticleWorld) {
    this.world = world;
  }

  get systems(): Set<ParticleSystem> {
    return this.world.systems;
  }

  get debug(): boolean | ParticleDebugOptions {
    return this.world.debug;
  }

  register(name: string, preset: ParticlePreset): this {
    this.world.register(name, preset);
    return this;
  }

  spawn(name: string, options?: ParticleSpawnOptions & { renderer?: THREE.WebGLRenderer }): ParticleSystem {
    return this.world.spawn(name, options);
  }

  preload(name: string, count: number): this {
    this.world.preload(name, count);
    return this;
  }

  setDebug(debug: boolean | ParticleDebugOptions): this {
    this.world.setDebug(debug);
    return this;
  }

  update(dt: number, camera: THREE.Camera): void {
    this.world.update(dt, camera);
  }

  clear(): void {
    this.world.clear();
  }
}

export interface WispParticleOptions extends ParticleWorldOptions {
  presets?: Record<string, ParticlePreset>;
}

export interface WispOptions {
  scene?: THREE.Object3D;
  camera: THREE.Camera;
  cameraEffects?: CameraEffectsOptions;
  particles?: WispParticleOptions;
}

export class Wisp {
  readonly camera: WispCamera;
  readonly particles?: WispParticles;
  private readonly cameraSystem: CameraEffectsSystem;
  private readonly renderCamera: THREE.Camera;

  constructor(camera: THREE.Camera, options?: CameraEffectsOptions);
  constructor(options: WispOptions);
  constructor(
    cameraOrOptions: THREE.Camera | WispOptions,
    legacyCameraOptions?: CameraEffectsOptions
  ) {
    const resolved = this.resolveOptions(cameraOrOptions, legacyCameraOptions);
    this.renderCamera = resolved.camera;
    this.cameraSystem = new CameraEffectsSystem(resolved.camera, resolved.cameraEffects?.shake);
    this.camera = new WispCamera(this.cameraSystem);
    if (resolved.scene && resolved.particles) {
      const world = new ParticleWorld(
        resolved.scene,
        resolved.particles.presets ?? {},
        {
          renderer: resolved.particles.renderer,
          pooling: resolved.particles.pooling,
        }
      );
      this.particles = new WispParticles(world);
    }
  }

  update(dt: number, camera?: THREE.Camera): void {
    this.camera.update(dt);
    if (this.particles) {
      this.particles.update(dt, camera ?? this.renderCamera);
    }
  }

  dispose(): void {
    this.particles?.clear();
    this.cameraSystem.dispose();
  }

  private resolveOptions(
    cameraOrOptions: THREE.Camera | WispOptions,
    legacyCameraOptions?: CameraEffectsOptions
  ): WispOptions {
    if (cameraOrOptions instanceof THREE.Camera) {
      return {
        camera: cameraOrOptions,
        cameraEffects: legacyCameraOptions,
      };
    }
    return cameraOrOptions;
  }
}
