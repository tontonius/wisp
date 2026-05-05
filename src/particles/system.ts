import * as THREE from "three";
import { assertValidParticlePreset } from "../particle-preset-validation";
import type { Particle, ParticleBackend, ParticleDebugOptions, ParticlePreset, ParticleSpawnOptions, ParticleSystemOptions, SoftParticleDepthTextureOptions } from "./types";
import { DEFAULT_EMITTER, makeEmitterGizmo, resolveDebugOptions } from "./shared";
import { CPUParticleBackend } from "./backends/cpu-backend";
import { GPUParticleBackend } from "./backends/gpu-backend";

function shouldUseGpu(preset: ParticlePreset, options: ParticleSystemOptions): boolean {
  if (preset.gpu?.forceCpuFallback) return false;
  if (preset.collision) return false;
  if (preset.subEmitters) return false;
  if (preset.renderer?.type === "stretchedBillboard") return false;
  if (preset.simulation === "cpu") return false;
  if (preset.simulation === "gpu") return !!options.renderer;
  if (preset.simulation === "auto") return !!options.renderer && (preset.maxParticles ?? 0) >= 2048;
  return false;
}

/**
 * Live particle effect instance backed by either CPU or GPU simulation.
 *
 * The selected backend is exposed via `backendType`.
 */
export class ParticleSystem extends THREE.Object3D {
  readonly preset: ParticlePreset;
  readonly backendType: "cpu" | "gpu";
  private backend: ParticleBackend;
  private gizmo?: THREE.LineSegments;
  private completionNotified = false;

  constructor(preset: ParticlePreset = {}, options: ParticleSystemOptions = {}) {
    super();
    this.preset = preset;

    assertValidParticlePreset(preset, { renderer: options.renderer });

    const useGpu = shouldUseGpu(preset, options);
    this.backendType = useGpu ? "gpu" : "cpu";
    this.backend = useGpu
      ? new GPUParticleBackend(preset, options.renderer!)
      : new CPUParticleBackend(preset, {
          onParticleBirth: (particle) => this.notifyParticleBirth(particle),
          onParticleDeath: (particle) => this.notifyParticleDeath(particle),
          onParticleCollision: (particle) => this.notifyParticleCollision(particle),
        });
    (this as unknown as THREE.Object3D).add(this.backend.object);
    this.setDebug(preset.debug);
  }

  /** Seconds elapsed since system start/restart. */
  get elapsed(): number {
    return this.backend.elapsed;
  }

  /** Approximate number of currently alive particles. */
  get aliveCount(): number {
    return this.backend.aliveCount;
  }

  /** True while particles can still be alive in the system. */
  get isAlive(): boolean {
    return this.backend.isAlive;
  }

  /** True while emission time is advancing. */
  get isPlaying(): boolean {
    return this.backend.isPlaying;
  }

  /** True when emission has finished and no particles remain alive. */
  get isComplete(): boolean {
    return this.backend.isComplete;
  }

  /** True once backend resources have been disposed. */
  get isDisposed(): boolean {
    return this.backend.isDisposed;
  }

  /**
   * Starts or resumes emission.
   *
   * Triggers `callbacks.onStart` when transitioning from not playing to playing.
   */
  play(): this {
    const wasPlaying = this.backend.isPlaying;
    this.backend.play();
    this.completionNotified = false;
    if (!wasPlaying) this.preset.callbacks?.onStart?.(this);
    return this;
  }

  /** Pauses emission progression without disposing resources. */
  pause(): this {
    this.backend.pause();
    return this;
  }

  /**
   * Stops emission.
   *
   * By default existing particles are cleared immediately (`clear: true`).
   */
  stop(options?: { clear?: boolean }): this {
    const wasActive = this.backend.isPlaying || this.backend.isAlive;
    this.backend.stop(options);
    this.completionNotified = this.backend.isComplete;
    if (wasActive) this.preset.callbacks?.onStop?.(this);
    return this;
  }

  /** Clears and starts the system from the beginning. */
  restart(): this {
    this.backend.restart();
    this.completionNotified = false;
    this.preset.callbacks?.onStart?.(this);
    return this;
  }

  /** Emits `count` particles immediately. */
  emit(count: number): this {
    this.backend.emit(count);
    return this;
  }

  /**
   * Enables or disables soft-particle depth fading.
   *
   * Pass `null` to disable depth-based fading.
   */
  setSoftParticleDepthTexture(depthTexture: THREE.Texture | null, options?: SoftParticleDepthTextureOptions): this {
    this.backend.setSoftParticleDepthTexture(depthTexture, options);
    return this;
  }

  /** Enables or updates debug gizmo visualization. */
  setDebug(debug: boolean | ParticleDebugOptions | undefined): this {
    const options = resolveDebugOptions(debug);

    if (!options.enabled) {
      if (this.gizmo) this.gizmo.visible = false;
      return this;
    }

    if (this.gizmo) {
      this.gizmo.removeFromParent();
      this.gizmo.geometry.dispose();
      (this.gizmo.material as THREE.Material).dispose();
    }

    this.gizmo = makeEmitterGizmo(this.preset.emitter ?? DEFAULT_EMITTER, options, this.preset.bounds);
    (this as unknown as THREE.Object3D).add(this.gizmo);
    return this;
  }

  /** Advances simulation and renderer data by `dt` seconds. */
  update(dt: number, camera: THREE.Camera): void {
    this.backend.update(dt, camera);
    if (this.backend.isComplete && !this.completionNotified) {
      this.completionNotified = true;
      this.preset.callbacks?.onComplete?.(this);
    }
  }

  /**
   * Disposes particle resources and removes the object from its parent.
   *
   * Set `disposeTexture: true` only if this system owns the texture.
   */
  dispose(options?: { disposeTexture?: boolean }): void {
    if (this.gizmo) {
      this.gizmo.geometry.dispose();
      (this.gizmo.material as THREE.Material).dispose();
      this.gizmo = undefined;
    }
    this.backend.dispose(options);
    (this as unknown as THREE.Object3D).removeFromParent();
  }

  private notifyParticleBirth(particle: Particle): void {
    this.preset.callbacks?.onParticleBirth?.(
      {
        position: particle.position.clone(),
        velocity: particle.velocity.clone(),
        age: particle.age,
        lifetime: particle.lifetime,
      },
      this
    );
  }

  private notifyParticleDeath(particle: Particle): void {
    this.preset.callbacks?.onParticleDeath?.(
      {
        position: particle.position.clone(),
        velocity: particle.velocity.clone(),
        age: particle.age,
        lifetime: particle.lifetime,
      },
      this
    );
  }

  private notifyParticleCollision(particle: Particle): void {
    this.preset.callbacks?.onParticleCollision?.(
      {
        position: particle.position.clone(),
        velocity: particle.velocity.clone(),
        age: particle.age,
        lifetime: particle.lifetime,
      },
      this
    );
  }
}

/**
 * Applies spawn transform/debug/autoplay options to a system.
 *
 * Resets transform to identity first so pooled systems do not keep stale values.
 */
export function configureSpawnedSystem(system: ParticleSystem, options: ParticleSpawnOptions): void {
  const systemObject = system as unknown as THREE.Object3D;
  systemObject.position.set(0, 0, 0);
  systemObject.rotation.set(0, 0, 0);
  systemObject.quaternion.identity();
  systemObject.scale.set(1, 1, 1);
  if (options.position) Array.isArray(options.position) ? systemObject.position.set(...options.position) : systemObject.position.copy(options.position);
  if (options.rotation) systemObject.rotation.copy(options.rotation);
  if (options.quaternion) systemObject.quaternion.copy(options.quaternion);
  if (typeof options.scale === "number") systemObject.scale.setScalar(options.scale);

  const parent = options.parent;
  if (parent) parent.add(systemObject);
  if (options.debug !== undefined) system.setDebug(options.debug);
  if (options.autoPlay ?? true) system.play();
}
