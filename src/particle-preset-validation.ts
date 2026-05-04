import type { WebGLRenderer } from "three";
import type { Curve, Gradient, ParticlePreset, Range } from "./particles";

export type ParticlePresetValidationContext = {
  renderer?: WebGLRenderer;
};

export type ParticlePresetValidationResult = {
  errors: string[];
  warnings: string[];
};

const EMITTER_TYPES = new Set(["point", "sphere", "hemisphere", "cone", "box"]);

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Mirrors `shouldUseGpu` in `particles.ts` for warning classification only. */
export function presetWouldUseGpu(preset: ParticlePreset, renderer: WebGLRenderer | undefined): boolean {
  if (preset.gpu?.forceCpuFallback) return false;
  if (preset.collision) return false;
  if (preset.subEmitters) return false;
  if (preset.simulation === "cpu") return false;
  if (preset.simulation === "gpu") return !!renderer;
  if (preset.simulation === "auto") return !!renderer && (preset.maxParticles ?? 0) >= 2048;
  return false;
}

function rangeBounds(value: Range | undefined, fallback: number): [number, number] {
  if (value === undefined) return [fallback, fallback];
  return Array.isArray(value) ? value : [value, value];
}

function validateFiniteRange(path: string, value: Range | undefined): string[] {
  const errors: string[] = [];
  if (value === undefined) return errors;
  if (Array.isArray(value)) {
    if (!isFiniteNumber(value[0])) errors.push(`${path}: range tuple min must be a finite number.`);
    if (!isFiniteNumber(value[1])) errors.push(`${path}: range tuple max must be a finite number.`);
  } else if (!isFiniteNumber(value)) {
    errors.push(`${path}: range must be a finite number.`);
  }
  return errors;
}

function validateCurve(path: string, curve: Curve | undefined): string[] {
  const errors: string[] = [];
  if (!curve || curve.length === 0) return errors;
  for (let i = 0; i < curve.length; i++) {
    const row = curve[i];
    if (!Array.isArray(row) || row.length < 2) {
      errors.push(`${path}: keyframe at index ${i} must be a [time, value] pair.`);
      continue;
    }
    const [t, v] = row;
    if (!isFiniteNumber(t)) errors.push(`${path}: keyframe at index ${i} has non-finite time.`);
    if (!isFiniteNumber(v)) errors.push(`${path}: keyframe at index ${i} has non-finite value.`);
    if (i > 0) {
      const prevT = curve[i - 1][0];
      if (isFiniteNumber(t) && isFiniteNumber(prevT) && t < prevT) {
        errors.push(`${path}: times must be non-decreasing (index ${i - 1} -> ${i}).`);
      }
    }
  }
  return errors;
}

function validateGradient(path: string, gradient: Gradient | undefined): string[] {
  const errors: string[] = [];
  if (!gradient || gradient.length === 0) return errors;
  for (let i = 0; i < gradient.length; i++) {
    const row = gradient[i];
    if (!Array.isArray(row) || row.length < 2) {
      errors.push(`${path}: keyframe at index ${i} must be a [time, color] pair.`);
      continue;
    }
    const [t] = row;
    if (!isFiniteNumber(t)) errors.push(`${path}: keyframe at index ${i} has non-finite time.`);
    if (i > 0) {
      const prevT = gradient[i - 1][0];
      if (isFiniteNumber(t) && isFiniteNumber(prevT) && t < prevT) {
        errors.push(`${path}: times must be non-decreasing (index ${i - 1} -> ${i}).`);
      }
    }
  }
  return errors;
}

function validateBurstCount(path: string, count: Range): string[] {
  return validateFiniteRange(path, count);
}

export function collectParticlePresetIssues(
  preset: ParticlePreset,
  context: ParticlePresetValidationContext = {}
): ParticlePresetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { renderer } = context;

  if (preset.maxParticles !== undefined) {
    if (!Number.isInteger(preset.maxParticles) || preset.maxParticles < 1) {
      errors.push("maxParticles: must be an integer >= 1 when set.");
    }
  }

  if (preset.duration !== undefined) {
    if (!isFiniteNumber(preset.duration) || preset.duration < 0) {
      errors.push("duration: must be a finite number >= 0 when set.");
    }
  }

  if (preset.emitter !== undefined) {
    const t = (preset.emitter as { type?: string }).type;
    if (typeof t !== "string" || !EMITTER_TYPES.has(t)) {
      errors.push(`emitter.type: must be one of ${[...EMITTER_TYPES].join(", ")}.`);
    }
  }

  const collision = preset.collision;
  if (collision !== undefined) {
    if (preset.simulation === "gpu") {
      errors.push('collision: CPU-only; use simulation "cpu", "auto", or omit collision for GPU presets.');
    }
    if (typeof collision !== "object" || collision === null || collision.type !== "plane") {
      errors.push('collision: must be an object with type "plane".');
    } else {
      if (collision.y !== undefined && !isFiniteNumber(collision.y)) {
        errors.push("collision.y: must be a finite number when set.");
      }
      if (collision.bounce !== undefined) {
        if (!isFiniteNumber(collision.bounce) || collision.bounce < 0) {
          errors.push("collision.bounce: must be a finite number >= 0 when set.");
        }
      }
      if (collision.dampening !== undefined) {
        if (!isFiniteNumber(collision.dampening) || collision.dampening < 0) {
          errors.push("collision.dampening: must be a finite number >= 0 when set.");
        }
      }
    }
  }

  const subEmitters = preset.subEmitters;
  if (subEmitters !== undefined) {
    if (preset.simulation === "gpu") {
      errors.push('subEmitters: CPU-only; use simulation "cpu", "auto", or omit subEmitters for GPU presets.');
    }
    if (typeof subEmitters !== "object" || subEmitters === null) {
      errors.push("subEmitters: must be an object when set.");
    } else {
      if (subEmitters.onBirth !== undefined) {
        if (typeof subEmitters.onBirth !== "string" || subEmitters.onBirth.trim().length === 0) {
          errors.push("subEmitters.onBirth: must be a non-empty effect name string when set.");
        }
      }
      if (subEmitters.onDeath !== undefined) {
        if (typeof subEmitters.onDeath !== "string" || subEmitters.onDeath.trim().length === 0) {
          errors.push("subEmitters.onDeath: must be a non-empty effect name string when set.");
        }
      }
      if (subEmitters.onCollision !== undefined) {
        if (typeof subEmitters.onCollision !== "string" || subEmitters.onCollision.trim().length === 0) {
          errors.push("subEmitters.onCollision: must be a non-empty effect name string when set.");
        }
      }
    }
  }

  const sheet = preset.renderer?.textureSheet;
  if (sheet) {
    const { columns, rows } = sheet;
    if (!Number.isInteger(columns) || columns < 1 || !isFiniteNumber(columns)) {
      errors.push("renderer.textureSheet.columns: must be an integer >= 1.");
    }
    if (!Number.isInteger(rows) || rows < 1 || !isFiniteNumber(rows)) {
      errors.push("renderer.textureSheet.rows: must be an integer >= 1.");
    }
  }

  const maxParticles = preset.maxParticles ?? 1024;

  if (preset.gpu?.textureSize !== undefined) {
    if (!Number.isInteger(preset.gpu.textureSize) || preset.gpu.textureSize < 1 || !isFiniteNumber(preset.gpu.textureSize)) {
      errors.push("gpu.textureSize: must be an integer >= 1 when set.");
    } else if (preset.gpu.textureSize * preset.gpu.textureSize < maxParticles) {
      errors.push(
        `gpu.textureSize: texture grid (${preset.gpu.textureSize}×${preset.gpu.textureSize}) must hold at least maxParticles (${maxParticles}). Increase textureSize or lower maxParticles.`
      );
    }
  }

  if (preset.gpu?.maxSpawnPerFrame !== undefined) {
    const m = preset.gpu.maxSpawnPerFrame;
    if (!isFiniteNumber(m) || !Number.isInteger(m) || m < 1) {
      errors.push("gpu.maxSpawnPerFrame: must be an integer >= 1 when set.");
    }
  }

  const start = preset.start;
  if (start) {
    errors.push(...validateFiniteRange("start.lifetime", start.lifetime));
    errors.push(...validateFiniteRange("start.speed", start.speed));
    errors.push(...validateFiniteRange("start.size", start.size));
    errors.push(...validateFiniteRange("start.rotation", start.rotation));
    errors.push(...validateFiniteRange("start.angularVelocity", start.angularVelocity));
    errors.push(...validateFiniteRange("start.opacity", start.opacity));
    const [, lifeMax] = rangeBounds(start.lifetime, 1);
    if (start.lifetime !== undefined && isFiniteNumber(lifeMax) && lifeMax <= 0) {
      errors.push("start.lifetime: upper bound must be > 0 so particles can have positive lifetime.");
    }
  }

  errors.push(...validateCurve("overLifetime.size", preset.overLifetime?.size));
  errors.push(...validateCurve("overLifetime.opacity", preset.overLifetime?.opacity));
  errors.push(...validateGradient("overLifetime.color", preset.overLifetime?.color));

  const vol = preset.velocityOverLifetime?.linear;
  if (vol) {
    errors.push(...validateCurve("velocityOverLifetime.linear.x", vol.x));
    errors.push(...validateCurve("velocityOverLifetime.linear.y", vol.y));
    errors.push(...validateCurve("velocityOverLifetime.linear.z", vol.z));
  }

  const bursts = preset.emission?.bursts;
  if (bursts) {
    bursts.forEach((b, i) => {
      const p = `emission.bursts[${i}]`;
      if (!isFiniteNumber(b.time) || b.time < 0) {
        errors.push(`${p}.time: must be a finite number >= 0.`);
      }
      errors.push(...validateBurstCount(`${p}.count`, b.count));
      if (b.probability !== undefined) {
        if (!isFiniteNumber(b.probability) || b.probability < 0 || b.probability > 1) {
          errors.push(`${p}.probability: must be a finite number in [0, 1] when set.`);
        }
      }
    });
  }

  errors.push(...validateFiniteRange("emission.rateOverTime", preset.emission?.rateOverTime));

  if (preset.simulation === "gpu" && !renderer) {
    warnings.push(
      "simulation is \"gpu\" but no WebGLRenderer was provided; falling back to CPU. Pass renderer in ParticleSystemOptions or ParticleWorldOptions."
    );
  }

  if (presetWouldUseGpu(preset, renderer) && preset.callbacks?.onParticleDeath) {
    warnings.push("callbacks.onParticleDeath is not invoked on the GPU backend; use CPU simulation for per-particle death callbacks.");
  }
  if (presetWouldUseGpu(preset, renderer) && preset.callbacks?.onParticleCollision) {
    warnings.push("callbacks.onParticleCollision is not invoked on the GPU backend; use CPU simulation for per-particle collision callbacks.");
  }
  if (presetWouldUseGpu(preset, renderer) && preset.callbacks?.onParticleBirth) {
    warnings.push("callbacks.onParticleBirth is not invoked on the GPU backend; use CPU simulation for per-particle birth callbacks.");
  }

  if (presetWouldUseGpu(preset, renderer) && preset.subEmitters?.onBirth) {
    warnings.push("subEmitters.onBirth is CPU-only and will not run on the GPU backend; use CPU simulation for built-in sub-emitters.");
  }
  if (presetWouldUseGpu(preset, renderer) && preset.subEmitters?.onDeath) {
    warnings.push("subEmitters.onDeath is CPU-only and will not run on the GPU backend; use CPU simulation for built-in sub-emitters.");
  }
  if (presetWouldUseGpu(preset, renderer) && preset.subEmitters?.onCollision) {
    warnings.push("subEmitters.onCollision is CPU-only and will not run on the GPU backend; use CPU simulation for built-in sub-emitters.");
  }

  if (preset.collision && preset.simulation === "auto" && renderer && (preset.maxParticles ?? 0) >= 2048) {
    warnings.push('simulation "auto" would otherwise select GPU at this capacity, but collision forces CPU simulation.');
  }

  return { errors, warnings };
}

export function assertValidParticlePreset(preset: ParticlePreset, context: ParticlePresetValidationContext = {}): void {
  const { errors, warnings } = collectParticlePresetIssues(preset, context);
  const seenWarn = new Set<string>();
  for (const w of warnings) {
    if (seenWarn.has(w)) continue;
    seenWarn.add(w);
    console.warn(`[ParticlePreset] ${w}`);
  }
  if (errors.length === 0) return;
  const msg = errors.length === 1 ? errors[0] : `Invalid particle preset (${errors.length} issues):\n- ${errors.join("\n- ")}`;
  throw new Error(msg);
}
