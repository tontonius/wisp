import { describe, expect, it, vi } from "vitest";
import {
  assertValidParticlePreset,
  collectParticlePresetIssues,
  presetWouldUseGpu,
} from "../../../src";
import type { ParticlePreset, ParticleRenderer } from "../../../src";

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

  it("accepts renderer.intensity when positive", () => {
    const preset = {
      simulation: "cpu" as const,
      maxParticles: 256,
      emitter: { type: "point" as const },
      emission: { rateOverTime: 10 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#ffffff", opacity: 1 },
      renderer: { blendMode: "additive" as const, align: "camera" as const, intensity: 2.5 },
    };
    const result = collectParticlePresetIssues(preset, {});
    expect(result.errors).toEqual([]);
  });

  it("passes with forces.pointAttractor", () => {
    const preset = {
      simulation: "cpu" as const,
      maxParticles: 256,
      emitter: { type: "point" as const },
      emission: { rateOverTime: 10 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#ffffff", opacity: 1 },
      renderer: { blendMode: "alpha" as const, align: "camera" as const },
      forces: {
        pointAttractor: {
          strength: 3,
          strengthOverLifetime: [
            [0, 0],
            [1, 1],
          ] as [number, number][],
        },
      },
    };
    const result = collectParticlePresetIssues(preset, {});
    expect(result.errors).toEqual([]);
  });

  it("accepts disc emitter presets", () => {
    const preset = {
      simulation: "cpu" as const,
      maxParticles: 256,
      emitter: { type: "disc" as const, radius: 0.5, emitFrom: "shell" as const },
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

  it("reports errors for invalid gpu.backend", () => {
    const preset = {
      simulation: "gpu" as const,
      maxParticles: 4096,
      gpu: { backend: "metal" },
      emitter: { type: "point" as const },
    };
    const result = collectParticlePresetIssues(preset as unknown as ParticlePreset, {});
    expect(result.errors).toContain('gpu.backend: must be "auto", "webgl", or "webgpu" when set.');
  });

  it("reports errors for invalid renderer.intensity", () => {
    const preset = {
      simulation: "cpu" as const,
      maxParticles: 256,
      emitter: { type: "point" as const },
      emission: { rateOverTime: 10 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#ffffff", opacity: 1 },
      renderer: { blendMode: "additive" as const, align: "camera" as const, intensity: 0 },
    };
    const result = collectParticlePresetIssues(preset, {});
    expect(result.errors).toContain("renderer.intensity: must be a finite number > 0 when set.");
  });

  it("warns when a preset resolves to the experimental WebGPU backend", () => {
    const preset = {
      simulation: "gpu" as const,
      maxParticles: 4096,
      gpu: { backend: "webgpu" as const },
      emitter: { type: "point" as const },
    };
    const renderer = { isWebGPURenderer: true } as const;
    const result = collectParticlePresetIssues(preset, { renderer });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain('gpu.backend "webgpu" is experimental; v0 renders TSL billboards with compute-updated motion through a narrow motion readback bridge, while CPU state is still mirrored for lifecycle bookkeeping and fallback.');
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

  it("logs each warning message once per session", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const preset = {
      simulation: "gpu" as const,
      maxParticles: 4096,
      gpu: { backend: "webgpu" as const },
      emitter: { type: "point" as const },
    };
    const renderer = { isWebGPURenderer: true } as const;

    assertValidParticlePreset(preset, { renderer });
    assertValidParticlePreset(preset, { renderer });

    expect(warn.mock.calls.filter(([message]) => String(message).includes('gpu.backend "webgpu" is experimental'))).toHaveLength(1);
    warn.mockRestore();
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

  it("honors explicit WebGL/WebGPU backend mismatches", () => {
    const preset = {
      simulation: "gpu" as const,
      maxParticles: 4096,
      gpu: { backend: "webgpu" as const },
      emitter: { type: "point" as const },
    };
    const webglRenderer = { isWebGLRenderer: true } as unknown as ParticleRenderer;
    const webgpuRenderer = { isWebGPURenderer: true } as const;
    expect(presetWouldUseGpu(preset, webglRenderer)).toBe(false);
    expect(presetWouldUseGpu(preset, webgpuRenderer)).toBe(true);
  });
});
