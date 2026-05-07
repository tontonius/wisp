import type { ParticlePreset } from "../../src";
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
): EditorLayer[] {
  const importedEffects = Object.entries(payload.effects);
  const layers = importedEffects.map(([effectKey, importedPreset]) => {
    const nextPreset = clonePreset(importedPreset);
    const subEmitters = nextPreset.subEmitters;
    delete nextPreset.subEmitters;
    const layer = createLayer(nextPreset, layerIdCounter);
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

  return layers;
}
