import type { ParticlePreset } from "../../src";
import { clonePreset } from "../lib/preset-utils";
import type { EditorLayer } from "./layers";

export function toExportEffectKey(name: string): string {
  const normalized = name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "effect";
}

export function buildExportEffectKeyMap(layers: EditorLayer[]): Map<string, string> {
  const keyByLayerId = new Map<string, string>();
  const used = new Set<string>();
  for (const layer of layers) {
    const base = toExportEffectKey(layer.name);
    let key = base;
    let suffix = 2;
    while (used.has(key)) {
      key = `${base}_${suffix++}`;
    }
    used.add(key);
    keyByLayerId.set(layer.id, key);
  }
  return keyByLayerId;
}

export function buildExportEffectsPayload(layers: EditorLayer[]): { effects: Record<string, ParticlePreset> } {
  const keyByLayerId = buildExportEffectKeyMap(layers);
  const effects: Record<string, ParticlePreset> = {};
  for (const layer of layers) {
    const key = keyByLayerId.get(layer.id);
    if (!key) continue;
    const preset = clonePreset(layer.preset);
    const subEmitters: NonNullable<ParticlePreset["subEmitters"]> = {};
    if (layer.eventLinks.onBirth !== "none") {
      const target = keyByLayerId.get(layer.eventLinks.onBirth);
      if (target) subEmitters.onBirth = target;
    }
    if (layer.eventLinks.onDeath !== "none") {
      const target = keyByLayerId.get(layer.eventLinks.onDeath);
      if (target) subEmitters.onDeath = target;
    }
    if (layer.eventLinks.onCollision !== "none") {
      const target = keyByLayerId.get(layer.eventLinks.onCollision);
      if (target) subEmitters.onCollision = target;
    }
    if (subEmitters.onBirth || subEmitters.onDeath || subEmitters.onCollision) preset.subEmitters = subEmitters;
    effects[key] = preset;
  }
  return { effects };
}
