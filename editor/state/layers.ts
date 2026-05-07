import type { ParticlePreset, ParticleSystem } from "../../src";
import { clonePreset } from "../lib/preset-utils";

export type EditorLayer = {
  id: string;
  name: string;
  preset: ParticlePreset;
  muted: boolean;
  solo: boolean;
  startOffsetSec: number;
  emitterOffset: { x: number; y: number; z: number };
  eventLinks: {
    onBirth: string;
    onDeath: string;
    onCollision: string;
  };
};

export function createLayer(preset: ParticlePreset, counter: { next: number }): EditorLayer {
  const id = `layer_${counter.next++}`;
  return {
    id,
    name: `Layer ${counter.next - 1}`,
    preset,
    muted: false,
    solo: false,
    startOffsetSec: 0,
    emitterOffset: { x: 0, y: 0.02, z: 0 },
    eventLinks: {
      onBirth: "none",
      onDeath: "none",
      onCollision: "none",
    },
  };
}

export function layerRuntimeName(layerId: string): string {
  return `editorLayer:${layerId}`;
}

export function sanitizeLayerEventLinks(layers: EditorLayer[]): void {
  const validLayerIds = new Set(layers.map((layer) => layer.id));
  for (const layer of layers) {
    const links = layer.eventLinks;
    if (!validLayerIds.has(links.onBirth)) links.onBirth = "none";
    if (!validLayerIds.has(links.onDeath)) links.onDeath = "none";
    if (!validLayerIds.has(links.onCollision)) links.onCollision = "none";
  }
}

export function createRuntimePresetForLayer(layer: EditorLayer): ParticlePreset {
  const preset = clonePreset(layer.preset);
  const nextSubEmitters: NonNullable<ParticlePreset["subEmitters"]> = {};
  if (layer.eventLinks.onBirth !== "none") nextSubEmitters.onBirth = layerRuntimeName(layer.eventLinks.onBirth);
  if (layer.eventLinks.onDeath !== "none") nextSubEmitters.onDeath = layerRuntimeName(layer.eventLinks.onDeath);
  if (layer.eventLinks.onCollision !== "none") nextSubEmitters.onCollision = layerRuntimeName(layer.eventLinks.onCollision);
  if (nextSubEmitters.onBirth || nextSubEmitters.onDeath || nextSubEmitters.onCollision) preset.subEmitters = nextSubEmitters;
  else delete preset.subEmitters;
  return preset;
}

export function getActiveLayerSystems(
  layers: EditorLayer[],
  activeSystemsByLayerId: Map<string, ParticleSystem>
): ParticleSystem[] {
  const soloed = layers.filter((layer) => layer.solo && !layer.muted);
  const activeLayers = soloed.length > 0 ? soloed : layers.filter((layer) => !layer.muted);
  return activeLayers.map((layer) => activeSystemsByLayerId.get(layer.id)).filter((s): s is ParticleSystem => !!s);
}
