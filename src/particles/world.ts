import * as THREE from "three";
import type { ParticleDebugOptions, ParticlePreset, ParticleSnapshot, ParticleSpawnOptions, ParticleWorldOptions } from "./types";
import { ParticleSystem, configureSpawnedSystem } from "./system";

/** Registry of named presets that can spawn `ParticleSystem` instances. */
export class ParticleEffectLibrary {
  private presets = new Map<string, ParticlePreset>();
  private defaultParent?: THREE.Object3D;
  private renderer?: THREE.WebGLRenderer;

  constructor(presets: Record<string, ParticlePreset> = {}, defaultParent?: THREE.Object3D, options: ParticleWorldOptions = {}) {
    this.defaultParent = defaultParent;
    this.renderer = options.renderer;
    Object.entries(presets).forEach(([name, preset]) => this.register(name, preset));
  }

  /** Registers or replaces a preset by name. */
  register(name: string, preset: ParticlePreset): this {
    this.presets.set(name, { ...preset, name });
    return this;
  }

  /** Returns a registered preset, if present. */
  get(name: string): ParticlePreset | undefined {
    return this.presets.get(name);
  }

  /**
   * Spawns a new system from a registered preset.
   *
   * Throws if `name` is unknown.
   */
  spawn(
    name: string,
    options: ParticleSpawnOptions & { renderer?: THREE.WebGLRenderer } = {}
  ): ParticleSystem {
    const preset = this.presets.get(name);
    if (!preset) throw new Error(`Unknown particle effect "${name}".`);

    const { renderer: spawnRenderer, ...rest } = options;
    const system = new ParticleSystem(preset, { renderer: spawnRenderer ?? this.renderer });
    configureSpawnedSystem(system, {
      ...rest,
      parent: rest.parent ?? this.defaultParent,
    });
    return system;
  }
}

/**
 * High-level particle manager with optional system pooling and sub-emitter orchestration.
 *
 * `spawn`/`update` are the main runtime methods for game loops.
 */
export class ParticleWorld {
  readonly effects: ParticleEffectLibrary;
  readonly systems = new Set<ParticleSystem>();
  private readonly inactivePool = new Map<string, ParticleSystem[]>();
  /** Tracks systems spawned through this world for auto-dispose pooling. */
  private readonly systemSpawnMeta = new Map<ParticleSystem, { name: string; poolable: boolean; subEmitterDepth: number }>();
  debug: boolean | ParticleDebugOptions = false;
  private readonly maxSubEmitterDepth = 3;

  constructor(private parent: THREE.Object3D, presets: Record<string, ParticlePreset> = {}, private options: ParticleWorldOptions = {}) {
    this.effects = new ParticleEffectLibrary(presets, parent, options);
  }

  private isPoolingEnabled(): boolean {
    const p = this.options.pooling;
    if (p === undefined || p === false) return false;
    return true;
  }

  private getPoolMaxPerEffect(): number | undefined {
    const p = this.options.pooling;
    if (p === undefined || p === false || p === true) return undefined;
    return p.maxPerEffect;
  }

  private disposePoolForEffect(name: string): void {
    const stack = this.inactivePool.get(name);
    if (!stack) return;
    for (const s of stack) s.dispose();
    this.inactivePool.delete(name);
  }

  private tryReturnToPool(name: string, system: ParticleSystem): void {
    system.stop({ clear: true });
    (system as unknown as THREE.Object3D).removeFromParent();
    const max = this.getPoolMaxPerEffect();
    const stack = this.inactivePool.get(name) ?? [];
    if (max !== undefined && stack.length >= max) {
      system.dispose();
      return;
    }
    stack.push(system);
    this.inactivePool.set(name, stack);
  }

  private createManagedPreset(basePreset: ParticlePreset): ParticlePreset {
    const originalCallbacks = basePreset.callbacks;
    return {
      ...basePreset,
      callbacks: {
        ...originalCallbacks,
        onParticleDeath: (particle, system) => {
          originalCallbacks?.onParticleDeath?.(particle, system);
          this.handleSubEmitterDeath(particle, system);
        },
        onParticleBirth: (particle, system) => {
          originalCallbacks?.onParticleBirth?.(particle, system);
          this.handleSubEmitterBirth(particle, system);
        },
        onParticleCollision: (particle, system) => {
          originalCallbacks?.onParticleCollision?.(particle, system);
          this.handleSubEmitterCollision(particle, system);
        },
      },
    };
  }

  private createManagedSystem(preset: ParticlePreset, renderer?: THREE.WebGLRenderer): ParticleSystem {
    const managedPreset = this.createManagedPreset(preset);
    return new ParticleSystem(managedPreset, { renderer });
  }

  private handleSubEmitterDeath(particle: ParticleSnapshot, system: ParticleSystem): void {
    const meta = this.systemSpawnMeta.get(system);
    if (!meta) return;

    const targetName = system.preset.subEmitters?.onDeath;
    if (!targetName) return;
    if (!this.effects.get(targetName)) return;
    if (meta.subEmitterDepth >= this.maxSubEmitterDepth) return;

    const worldPosition = this.resolveParticleWorldPosition(particle, system);

    this.spawnInternal(
      targetName,
      {
        position: worldPosition,
        parent: this.parent,
      },
      meta.subEmitterDepth + 1
    );
  }

  private handleSubEmitterBirth(particle: ParticleSnapshot, system: ParticleSystem): void {
    const meta = this.systemSpawnMeta.get(system);
    if (!meta) return;

    const targetName = system.preset.subEmitters?.onBirth;
    if (!targetName) return;
    if (!this.effects.get(targetName)) return;
    if (meta.subEmitterDepth >= this.maxSubEmitterDepth) return;

    const worldPosition = this.resolveParticleWorldPosition(particle, system);

    this.spawnInternal(
      targetName,
      {
        position: worldPosition,
        parent: this.parent,
      },
      meta.subEmitterDepth + 1
    );
  }

  private handleSubEmitterCollision(particle: ParticleSnapshot, system: ParticleSystem): void {
    const meta = this.systemSpawnMeta.get(system);
    if (!meta) return;

    const targetName = system.preset.subEmitters?.onCollision;
    if (!targetName) return;
    if (!this.effects.get(targetName)) return;
    if (meta.subEmitterDepth >= this.maxSubEmitterDepth) return;

    const worldPosition = this.resolveParticleWorldPosition(particle, system);

    this.spawnInternal(
      targetName,
      {
        position: worldPosition,
        parent: this.parent,
      },
      meta.subEmitterDepth + 1
    );
  }

  private spawnInternal(name: string, options: Parameters<ParticleEffectLibrary["spawn"]>[1] = {}, subEmitterDepth: number): ParticleSystem {
    const debug = options.debug ?? this.debug;
    const merged: ParticleSpawnOptions & { renderer?: THREE.WebGLRenderer } = {
      parent: this.parent,
      renderer: this.options.renderer,
      ...options,
      ...(debug ? { debug } : {}),
    };

    const preset = this.effects.get(name);
    if (!preset) throw new Error(`Unknown particle effect "${name}".`);

    const spawnRenderer = options.renderer ?? this.options.renderer;
    const poolable = this.isPoolingEnabled() && spawnRenderer === this.options.renderer;

    let system: ParticleSystem | undefined;
    if (poolable) {
      const stack = this.inactivePool.get(name);
      if (stack && stack.length > 0) system = stack.pop();
    }

    if (!system) {
      system = this.createManagedSystem(preset, spawnRenderer);
    }

    const { renderer: _spawnRenderer, ...configureOpts } = merged;
    configureSpawnedSystem(system, configureOpts);

    this.systems.add(system);
    this.systemSpawnMeta.set(system, { name, poolable, subEmitterDepth });
    return system;
  }

  private resolveParticleWorldPosition(particle: ParticleSnapshot, system: ParticleSystem): THREE.Vector3 {
    const worldPosition = particle.position.clone();
    if ((system.preset.simulationSpace ?? "local") === "world") return worldPosition;
    (system as unknown as THREE.Object3D).localToWorld(worldPosition);
    return worldPosition;
  }

  /** Registers or replaces a world preset and clears inactive pool for that name. */
  register(name: string, preset: ParticlePreset): this {
    this.effects.register(name, preset);
    this.disposePoolForEffect(name);
    return this;
  }

  /**
   * Pre-allocates pooled systems for an effect.
   *
   * Requires pooling to be enabled and `count` to be an integer >= 1.
   */
  preload(name: string, count: number): this {
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`ParticleWorld.preload("${name}", count): count must be an integer >= 1.`);
    }
    if (!this.isPoolingEnabled()) {
      throw new Error('ParticleWorld.preload requires pooling to be enabled via ParticleWorldOptions.pooling.');
    }

    const preset = this.effects.get(name);
    if (!preset) throw new Error(`Unknown particle effect "${name}".`);

    const stack = this.inactivePool.get(name) ?? [];
    const max = this.getPoolMaxPerEffect();
    const remainingCapacity = max === undefined ? count : Math.max(0, Math.min(count, max - stack.length));
    if (remainingCapacity <= 0) {
      this.inactivePool.set(name, stack);
      return this;
    }

    for (let i = 0; i < remainingCapacity; i++) {
      stack.push(this.createManagedSystem(preset, this.options.renderer));
    }
    this.inactivePool.set(name, stack);
    return this;
  }

  /** Spawns an effect by name, optionally overriding transform/debug/renderer settings. */
  spawn(name: string, options: Parameters<ParticleEffectLibrary["spawn"]>[1] = {}): ParticleSystem {
    return this.spawnInternal(name, options, 0);
  }

  /** Sets default debug behavior for active and future spawned systems. */
  setDebug(debug: boolean | ParticleDebugOptions): this {
    this.debug = debug;
    for (const system of this.systems) system.setDebug(debug);
    return this;
  }

  /**
   * Advances all tracked systems by `dt` seconds.
   *
   * Completed one-shot systems are auto-disposed or returned to the pool.
   */
  update(dt: number, camera: THREE.Camera): void {
    for (const system of [...this.systems]) {
      if (system.isDisposed) {
        this.systems.delete(system);
        this.systemSpawnMeta.delete(system);
        continue;
      }
      system.update(dt, camera);
      if (!(system.preset.autoDispose ?? true) || !system.isComplete) continue;

      const meta = this.systemSpawnMeta.get(system);
      this.systems.delete(system);
      this.systemSpawnMeta.delete(system);

      if (meta?.poolable && this.isPoolingEnabled()) {
        this.tryReturnToPool(meta.name, system);
      } else {
        system.dispose();
      }
    }
  }

  /** Disposes all active and pooled systems and empties world state. */
  clear(): void {
    for (const system of this.systems) system.dispose();
    this.systems.clear();
    this.systemSpawnMeta.clear();
    for (const stack of this.inactivePool.values()) for (const s of stack) s.dispose();
    this.inactivePool.clear();
  }
}
