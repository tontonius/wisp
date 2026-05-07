import { describe, expect, it } from "vitest";
import { buildExportEffectsPayload, toExportEffectKey } from "../../../editor/state/export.js";
import {
  createLayer,
  createRuntimePresetForLayer,
  sanitizeLayerEventLinks,
} from "../../../editor/state/layers.js";
import { clonePreset } from "../../../editor/lib/preset-utils.js";
import type { ParticlePreset } from "../../../src";

const minimalPreset = (): ParticlePreset =>
  ({
    simulation: "cpu",
    maxParticles: 8,
    emitter: { type: "point" },
    emission: { rateOverTime: 1 },
    start: { lifetime: 1, speed: 1, size: 1, color: "#fff", opacity: 1 },
    renderer: { blendMode: "alpha", align: "camera" },
  }) as ParticlePreset;

describe("layers export", () => {
  it("toExportEffectKey sanitizes names", () => {
    expect(toExportEffectKey("My Effect!!")).toBe("My_Effect");
    expect(toExportEffectKey("   ")).toBe("effect");
  });

  it("buildExportEffectsPayload dedupes collision keys", () => {
    const counter = { next: 1 };
    const a = createLayer(minimalPreset(), counter);
    const b = createLayer(minimalPreset(), counter);
    a.name = "dup";
    b.name = "dup";
    const payload = buildExportEffectsPayload([a, b]);
    expect(Object.keys(payload.effects).sort()).toEqual(["dup", "dup_2"]);
  });

  it("sanitizeLayerEventLinks resets dangling ids", () => {
    const counter = { next: 1 };
    const a = createLayer(minimalPreset(), counter);
    const b = createLayer(minimalPreset(), counter);
    b.eventLinks.onBirth = "missing";
    sanitizeLayerEventLinks([a, b]);
    expect(b.eventLinks.onBirth).toBe("none");
  });

  it("createLayer includes editor-only emitter offset defaults", () => {
    const counter = { next: 1 };
    const layer = createLayer(minimalPreset(), counter);
    expect(layer.emitterOffset).toEqual({ x: 0, y: 0.02, z: 0 });
  });

  it("createRuntimePresetForLayer maps event links to runtime names", () => {
    const counter = { next: 1 };
    const a = createLayer(minimalPreset(), counter);
    const b = createLayer(minimalPreset(), counter);
    b.eventLinks.onBirth = a.id;
    const preset = createRuntimePresetForLayer(b);
    expect(preset.subEmitters?.onBirth).toBe(`editorLayer:${a.id}`);
  });
});
