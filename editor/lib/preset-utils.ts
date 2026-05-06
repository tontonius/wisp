import type { ParticlePreset } from "../../src";
import type { NumberRange } from "../types.js";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

export function clonePreset<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clonePreset(item)) as T;
  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) next[k] = clonePreset(v);
    return next as T;
  }
  return value;
}

export function asRange(value: number | NumberRange | undefined, fallback: NumberRange): NumberRange {
  if (Array.isArray(value)) return value;
  if (typeof value === "number") return [value, value];
  return fallback;
}

export function ensureEmitter(preset: ParticlePreset): NonNullable<ParticlePreset["emitter"]> {
  if (!preset.emitter) preset.emitter = { type: "sphere", radius: 0.4, emitFrom: "volume" };
  return preset.emitter;
}

export function ensureStart(preset: ParticlePreset): NonNullable<ParticlePreset["start"]> {
  if (!preset.start) preset.start = {};
  return preset.start;
}

export function ensureEmission(preset: ParticlePreset): NonNullable<ParticlePreset["emission"]> {
  if (!preset.emission) preset.emission = {};
  return preset.emission;
}
