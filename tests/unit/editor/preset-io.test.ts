/** @vitest-environment happy-dom */

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createSafePresetSerializer,
  extractPresetFromJsonValue,
  extractSessionLayersFromJsonValue,
  looksLikePresetCandidate,
  parsePresetInput,
  sanitizeImportedPreset,
  stringifyEditorSession,
} from "../../../editor/lib/preset-io.js";
import { clonePreset } from "../../../editor/lib/preset-utils.js";
import type { EditorLayer } from "../../../editor/state/layers.js";
import type { ParticlePreset } from "../../../src";

describe("preset-io", () => {
  it("createSafePresetSerializer stringifies texture as token", () => {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    tex.uuid = "test-uuid";
    expect(tex.isTexture).toBe(true);
    const preset = { renderer: { texture: tex } } as ParticlePreset;
    const json = JSON.stringify(preset, createSafePresetSerializer());
    expect(json).toContain("[Texture:");
    expect(json).toContain("test-uuid");
  });

  it("extractPresetFromJsonValue unwraps wrapped keys", () => {
    const inner: ParticlePreset = {
      simulation: "cpu",
      maxParticles: 10,
      emitter: { type: "point" },
      emission: {},
      start: {},
      renderer: {},
    } as ParticlePreset;
    const extracted = extractPresetFromJsonValue({ preset: inner });
    expect(extracted?.maxParticles).toBe(10);
  });

  it("looksLikePresetCandidate detects preset-shaped objects", () => {
    expect(looksLikePresetCandidate({ maxParticles: 10 })).toBe(true);
    expect(looksLikePresetCandidate({ foo: 1 })).toBe(false);
  });

  it("parsePresetInput parses JSON and relaxed literals", () => {
    const builtins = {
      softDisc: {} as THREE.Texture,
      hardDisc: {} as THREE.Texture,
      spark: {} as THREE.Texture,
    };
    expect(parsePresetInput(`{"maxParticles":99}`, builtins)).toEqual({ maxParticles: 99 });
    const literal = parsePresetInput("{ maxParticles: 7 }", builtins);
    expect(literal).toEqual({ maxParticles: 7 });
  });

  it("stringifyEditorSession and extractSessionLayersFromJsonValue round-trip", () => {
    const layer: EditorLayer = {
      id: "layer_1",
      name: "A",
      muted: false,
      solo: false,
      startOffsetSec: 0,
      eventLinks: { onBirth: "none", onDeath: "none", onCollision: "none" },
      preset: { simulation: "cpu", maxParticles: 4, emitter: { type: "point" }, emission: {}, start: {}, renderer: {} } as ParticlePreset,
    };
    const json = stringifyEditorSession([layer], layer.id, false);
    const parsed = JSON.parse(json) as unknown;
    const restored = extractSessionLayersFromJsonValue(parsed);
    expect(restored?.length).toBe(1);
    expect(restored?.[0]?.name).toBe("A");
    expect(restored?.[0]?.preset.maxParticles).toBe(4);
  });

  it("sanitizeImportedPreset strips serialized renderer.texture objects", () => {
    const preset = clonePreset({
      renderer: { texture: { image: "not-a-texture" }, blendMode: "alpha", align: "camera" },
    }) as ParticlePreset;
    const { preset: next, warnings } = sanitizeImportedPreset(preset);
    expect(warnings.length).toBeGreaterThan(0);
    expect(next.renderer?.texture).toBeUndefined();
  });
});
