import * as THREE from "three";
import type { ParticlePreset } from "../../src";
import { clonePreset, isPlainObject } from "./preset-utils";
import type { EditorLayer } from "../state/layers";

const PRESET_TOP_LEVEL_KEYS = new Set([
  "name",
  "simulation",
  "simulationSpace",
  "bounds",
  "maxParticles",
  "duration",
  "loop",
  "prewarm",
  "autoDispose",
  "gpu",
  "emitter",
  "emission",
  "start",
  "forces",
  "velocityOverLifetime",
  "overLifetime",
  "limitVelocityOverLifetime",
  "colorBySpeed",
  "sizeBySpeed",
  "rotationBySpeed",
  "renderer",
  "collision",
  "subEmitters",
  "inheritVelocity",
  "lifetimeByEmitterSpeed",
]);

export function createSafePresetSerializer() {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown): unknown => {
    if (value && typeof value === "object") {
      const tex = value as THREE.Texture;
      if (tex.isTexture) {
        return `[Texture:${tex.name || tex.uuid}]`;
      }
      const meta = (value as { metadata?: { type?: string }; uuid?: string }).metadata;
      if (meta?.type === "Texture") {
        const uuid = (value as { uuid?: string }).uuid ?? "";
        return `[Texture:${uuid}]`;
      }
    }
    if (typeof value === "function") return undefined;
    if (value && typeof value === "object") {
      if (seen.has(value as object)) return "[Circular]";
      seen.add(value as object);
    }
    return value;
  };
}

export function stringifyPreset(preset: ParticlePreset, pretty = false): string {
  return JSON.stringify(preset, createSafePresetSerializer(), pretty ? 2 : undefined);
}

export function looksLikePresetCandidate(value: unknown): value is ParticlePreset {
  if (!isPlainObject(value)) return false;
  return Object.keys(value).some((key) => PRESET_TOP_LEVEL_KEYS.has(key));
}

export function extractPresetFromJsonValue(value: unknown): ParticlePreset | undefined {
  if (looksLikePresetCandidate(value)) return value;
  if (!isPlainObject(value)) return undefined;

  const wrappedCandidateKeys = ["preset", "effect", "particle", "particlePreset"];
  for (const key of wrappedCandidateKeys) {
    const candidate = (value as Record<string, unknown>)[key];
    if (looksLikePresetCandidate(candidate)) return candidate;
  }

  const collectionKeys = ["presets", "effects"];
  for (const key of collectionKeys) {
    const collection = (value as Record<string, unknown>)[key];
    if (Array.isArray(collection)) {
      const first = collection.find((item) => looksLikePresetCandidate(item));
      if (first) return first as ParticlePreset;
    } else if (isPlainObject(collection)) {
      const first = Object.values(collection).find((item) => looksLikePresetCandidate(item));
      if (first) return first as ParticlePreset;
    }
  }

  const directValues = Object.values(value);
  const firstPreset = directValues.find((item) => looksLikePresetCandidate(item));
  return firstPreset as ParticlePreset | undefined;
}

export function stringifyEditorSession(layers: EditorLayer[], selectedLayerId: string, pretty = false): string {
  const payload = {
    schema: "editor-multi-effect-session-v1",
    layers: layers.map((layer) => ({
      name: layer.name,
      muted: layer.muted,
      solo: layer.solo,
      startOffsetSec: layer.startOffsetSec,
      eventLinks: layer.eventLinks,
      preset: layer.preset,
    })),
    selectedLayerIndex: Math.max(0, layers.findIndex((layer) => layer.id === selectedLayerId)),
  };
  return JSON.stringify(payload, createSafePresetSerializer(), pretty ? 2 : undefined);
}

export function extractSessionLayersFromJsonValue(value: unknown): Array<Omit<EditorLayer, "id">> | undefined {
  if (!isPlainObject(value)) return undefined;
  const collection = (value as Record<string, unknown>).layers;
  if (!Array.isArray(collection)) return undefined;
  const parsed: Array<Omit<EditorLayer, "id">> = [];
  for (const item of collection) {
    if (!isPlainObject(item)) continue;
    const candidate = extractPresetFromJsonValue((item as Record<string, unknown>).preset ?? item);
    if (!candidate) continue;
    parsed.push({
      name: typeof item.name === "string" ? item.name : `Layer ${parsed.length + 1}`,
      muted: !!item.muted,
      solo: !!item.solo,
      startOffsetSec: Math.max(0, Number(item.startOffsetSec) || 0),
      eventLinks: {
        onBirth: typeof item.eventLinks === "object" && item.eventLinks && typeof (item.eventLinks as Record<string, unknown>).onBirth === "string"
          ? ((item.eventLinks as Record<string, string>).onBirth ?? "none")
          : "none",
        onDeath: typeof item.eventLinks === "object" && item.eventLinks && typeof (item.eventLinks as Record<string, unknown>).onDeath === "string"
          ? ((item.eventLinks as Record<string, string>).onDeath ?? "none")
          : "none",
        onCollision: typeof item.eventLinks === "object" && item.eventLinks && typeof (item.eventLinks as Record<string, unknown>).onCollision === "string"
          ? ((item.eventLinks as Record<string, string>).onCollision ?? "none")
          : "none",
      },
      preset: clonePreset(candidate),
    });
  }
  return parsed.length > 0 ? parsed : undefined;
}

export type BuiltinTextures = {
  softDisc: THREE.Texture;
  hardDisc: THREE.Texture;
  spark: THREE.Texture;
};

export function parsePresetInput(text: string, builtins: BuiltinTextures): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return Function(
      "softDisc",
      "hardDisc",
      "spark",
      `"use strict"; return (${text});`
    )(builtins.softDisc, builtins.hardDisc, builtins.spark) as unknown;
  }
}

export function sanitizeImportedPreset(preset: ParticlePreset): { preset: ParticlePreset; warnings: string[] } {
  const next = clonePreset(preset);
  const warnings: string[] = [];

  const rendererTexture = next.renderer?.texture;
  if (rendererTexture !== undefined && !(rendererTexture as THREE.Texture).isTexture) {
    if (next.renderer) delete next.renderer.texture;
    warnings.push("renderer.texture was a serialized/non-live texture object and was removed.");
  }

  const dispersalTexture = next.renderer?.dispersal?.texture;
  if (dispersalTexture !== undefined && !(dispersalTexture as THREE.Texture).isTexture) {
    if (next.renderer?.dispersal) delete next.renderer.dispersal.texture;
    warnings.push("renderer.dispersal.texture was a serialized/non-live texture object and was removed.");
  }

  return { preset: next, warnings };
}
