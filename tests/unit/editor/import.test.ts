import { describe, expect, it } from "vitest";
import { buildLayersFromImportEffectsPayload, parseImportEffectsPayload } from "../../../editor/state/import.js";

describe("editor import", () => {
  it("sanitizes serialized texture placeholders during effects import", () => {
    const payload = parseImportEffectsPayload(
      JSON.stringify({
        effects: {
          explosion: {
            simulation: "cpu",
            maxParticles: 16,
            emitter: { type: "point" },
            emission: {},
            start: {},
            renderer: {
              texture: "[Texture:placeholder-id]",
            },
          },
        },
      })
    );

    const { layers, warnings } = buildLayersFromImportEffectsPayload(payload, { next: 1 });
    expect(layers.length).toBe(1);
    expect(layers[0]?.preset.renderer?.texture).toBeUndefined();
    expect(warnings.some((warning) => warning.includes("renderer.texture"))).toBe(true);
  });
});
