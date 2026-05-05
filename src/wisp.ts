import * as THREE from "three";
import { CameraEffectsSystem } from "./camera/system";
import type { CameraEffectsOptions, CameraShakeImpulse, CameraShakeOptions } from "./camera/types";
import type { ParticleSystem } from "./particles/system";
import { ParticleWorld } from "./particles/world";
import type { ParticleDebugOptions, ParticlePreset, ParticleSpawnOptions, ParticleWorldOptions } from "./particles/types";

/** High-level camera module exposed on `wisp.camera`. */
export class WispCamera {
  private readonly system: CameraEffectsSystem;

  constructor(system: CameraEffectsSystem) {
    this.system = system;
  }

  get trauma(): number {
    return this.system.trauma;
  }

  /**
   * Adds a camera shake impulse.
   *
   * `impulse` can be a number (trauma amount) or `{ trauma }`.
   * Trauma is clamped to `[0, 1]`.
   */
  shake(impulse: CameraShakeImpulse): this {
    this.system.shake(impulse);
    return this;
  }

  /**
   * Replaces camera shake tuning values at runtime.
   *
   * Omitted fields keep their default values from `CameraShakeOptions`.
   */
  configureShake(options?: CameraShakeOptions): this {
    this.system.configureShake(options);
    return this;
  }

  /** Advances camera effects by `dt` seconds. */
  update(dt: number): void {
    this.system.update(dt);
  }

  /** Clears trauma and restores baseline shake state. */
  reset(): this {
    this.system.reset();
    return this;
  }
}

/** High-level particle module exposed on `wisp.particles`. */
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

  /** Registers or replaces a named particle preset. */
  register(name: string, preset: ParticlePreset): this {
    this.world.register(name, preset);
    return this;
  }

  /**
   * Spawns a particle effect by registered preset name.
   *
   * Use `options.renderer` to override the default world renderer for this spawn.
   */
  spawn(name: string, options?: ParticleSpawnOptions & { renderer?: THREE.WebGLRenderer }): ParticleSystem {
    return this.world.spawn(name, options);
  }

  /**
   * Pre-allocates pooled systems for an effect.
   *
   * Requires `particles.pooling` to be enabled in `WispOptions`.
   */
  preload(name: string, count: number): this {
    this.world.preload(name, count);
    return this;
  }

  /** Sets debug gizmo behavior for active and future spawned systems. */
  setDebug(debug: boolean | ParticleDebugOptions): this {
    this.world.setDebug(debug);
    return this;
  }

  /** Advances all active particle systems by `dt` seconds. */
  update(dt: number, camera: THREE.Camera): void {
    this.world.update(dt, camera);
  }

  /** Disposes all active systems and clears pooled inactive systems. */
  clear(): void {
    this.world.clear();
  }
}

/** Options for configuring `wisp.particles`. */
export interface WispParticleOptions extends ParticleWorldOptions {
  /** Initial presets registered at construction time. */
  presets?: Record<string, ParticlePreset>;
}

/** Root constructor options for `Wisp`. */
export interface WispOptions {
  /** Scene object used as particle parent. Required for `particles` module. */
  scene?: THREE.Object3D;
  /** Render camera used by camera effects and default particle updates. */
  camera: THREE.Camera;
  /** Camera-effects module options. */
  cameraEffects?: CameraEffectsOptions;
  /** Particle module options. If omitted, `wisp.particles` is undefined. */
  particles?: WispParticleOptions;
}

/**
 * Main public facade for Wisp modules.
 *
 * Supports two constructor styles:
 * - `new Wisp(camera, cameraEffects?)` for camera-only usage.
 * - `new Wisp({ camera, scene, cameraEffects, particles })` for full modular setup.
 */
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

  /**
   * Updates all enabled modules.
   *
   * `dt` is in seconds. When particle support is enabled and `camera` is omitted,
   * the camera passed at construction time is used.
   */
  update(dt: number, camera?: THREE.Camera): void {
    this.camera.update(dt);
    if (this.particles) {
      this.particles.update(dt, camera ?? this.renderCamera);
    }
  }

  /** Disposes module state and releases owned resources. */
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
