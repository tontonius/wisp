import { describe, expect, it } from "vitest";
import {
  assertValidParticlePreset,
  collectParticlePresetIssues,
  presetWouldUseGpu,
} from "../../../src";

describe("collectParticlePresetIssues", () => {
  it("passes for a minimal valid preset", () => {
    const preset = {
      simulation: "cpu" as const,
      maxParticles: 256,
      emitter: { type: "point" as const },
      emission: { rateOverTime: 10 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#ffffff", opacity: 1 },
      renderer: { blendMode: "alpha" as const, align: "camera" as const },
    };
    const result = collectParticlePresetIssues(preset, {});
    expect(result.errors).toEqual([]);
  });

  it("reports errors for invalid maxParticles", () => {
    const preset = {
      simulation: "cpu" as const,
      maxParticles: 0,
      emitter: { type: "point" as const },
      emission: { rateOverTime: 10 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#ffffff", opacity: 1 },
      renderer: { blendMode: "alpha" as const, align: "camera" as const },
    };
    const result = collectParticlePresetIssues(preset, {});
    expect(result.errors.some((e) => e.includes("maxParticles"))).toBe(true);
  });
});

describe("assertValidParticlePreset", () => {
  it("throws when preset has blocking errors", () => {
    const preset = {
      simulation: "cpu" as const,
      maxParticles: -1,
      emitter: { type: "point" as const },
      emission: { rateOverTime: 10 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#ffffff", opacity: 1 },
      renderer: { blendMode: "alpha" as const, align: "camera" as const },
    };
    expect(() => assertValidParticlePreset(preset)).toThrow();
  });
});

describe("presetWouldUseGpu", () => {
  it("returns false for cpu simulation", () => {
    const preset = {
      simulation: "cpu" as const,
      maxParticles: 4096,
      emitter: { type: "point" as const },
      emission: { rateOverTime: 10 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#ffffff", opacity: 1 },
      renderer: { blendMode: "alpha" as const, align: "camera" as const },
    };
    expect(presetWouldUseGpu(preset, undefined)).toBe(false);
  });
});
