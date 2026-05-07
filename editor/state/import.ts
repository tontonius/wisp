import type { ParticlePreset } from "../../src";
import { sanitizeImportedPreset } from "../lib/preset-io";
import { clonePreset } from "../lib/preset-utils";
import { createLayer, type EditorLayer } from "./layers";

type ImportEffectsPayload = { effects: Record<string, ParticlePreset> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeImportEffectsPayload(value: unknown): ImportEffectsPayload {
  if (!isRecord(value)) throw new Error("Expected a JSON object.");
  if (!isRecord(value.effects)) throw new Error('Expected an "effects" object.');

  const entries = Object.entries(value.effects).filter((entry): entry is [string, ParticlePreset] => {
    return isRecord(entry[1]);
  });

  if (entries.length === 0) throw new Error('No effects found in "effects".');
  return { effects: Object.fromEntries(entries) };
}

export function parseImportEffectsPayload(source: string): ImportEffectsPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }
  return normalizeImportEffectsPayload(parsed);
}

export function buildLayersFromImportEffectsPayload(
  payload: ImportEffectsPayload,
  layerIdCounter: { next: number }
): { layers: EditorLayer[]; warnings: string[] } {
  const importedEffects = Object.entries(payload.effects);
  const warnings: string[] = [];
  const layers = importedEffects.map(([effectKey, importedPreset]) => {
    const nextPreset = clonePreset(importedPreset);
    const { preset: sanitizedPreset, warnings: presetWarnings } = sanitizeImportedPreset(nextPreset);
    for (const warning of presetWarnings) warnings.push(`${effectKey}: ${warning}`);
    const normalizedPreset = sanitizedPreset;
    const subEmitters = normalizedPreset.subEmitters;
    delete normalizedPreset.subEmitters;
    const layer = createLayer(normalizedPreset, layerIdCounter);
    layer.name = effectKey.trim() || layer.name;
    layer.eventLinks = {
      onBirth: subEmitters?.onBirth ?? "none",
      onDeath: subEmitters?.onDeath ?? "none",
      onCollision: subEmitters?.onCollision ?? "none",
    };
    return layer;
  });

  const importedKeyToLayerId = new Map(layers.map((layer) => [layer.name, layer.id]));
  for (const layer of layers) {
    layer.eventLinks = {
      onBirth: importedKeyToLayerId.get(layer.eventLinks.onBirth) ?? "none",
      onDeath: importedKeyToLayerId.get(layer.eventLinks.onDeath) ?? "none",
      onCollision: importedKeyToLayerId.get(layer.eventLinks.onCollision) ?? "none",
    };
  }

  return { layers, warnings };
}
