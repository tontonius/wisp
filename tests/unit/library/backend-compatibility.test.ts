import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { compareParticlePresetBackends } from "../../../src";
import type { ParticlePreset } from "../../../src";

function makeTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

describe("compareParticlePresetBackends", () => {
  it("compares a WebGPU-ready smoke slice across CPU, WebGL, and WebGPU", () => {
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 512,
      emitter: { type: "cone", radius: 0.15, angle: 20, length: 1 },
      emission: { rateOverTime: 60, bursts: [{ time: 0, count: 40 }] },
      start: {
        lifetime: [0.8, 1.4],
        speed: [0.5, 1.5],
        size: [0.2, 0.6],
        color: ["#7fd5ff", "#fff1ba"],
        opacity: [0.5, 1],
      },
      forces: {
        drag: 0.2,
        pointAttractor: { center: [0, 1, 0], strength: 0.4 },
        vortex: { center: [0, 0, 0], axis: [0, 1, 0], orbitalSpeed: 0.4 },
        noise: { strength: 0.5, frequency: 2 },
      },
      renderer: {
        texture: makeTexture(),
        textureSheet: { columns: 2, rows: 2, animationMode: "randomStart" },
        blendMode: "alpha",
        intensity: 2,
        sorting: "none",
        softParticles: true,
        dispersal: { amount: [[0, 0], [1, 1]] },
      },
    };

    const rows = compareParticlePresetBackends(preset);

    expect(rows.map((row) => row.target)).toEqual(["cpu", "webgl", "webgpu"]);
    expect(rows[0].selection).toMatchObject({ simulation: "cpu" });
    expect(rows[1].selection).toMatchObject({ simulation: "gpu", backend: "webgl" });
    expect(rows[2].selection).toMatchObject({ simulation: "gpu", backend: "webgpu" });
    expect(rows.flatMap((row) => row.errors)).toEqual([]);
    expect(rows.find((row) => row.target === "webgpu")?.issueLabels).toContain("experimental");
  });

  it("shows stretched billboards falling back on WebGL but selecting WebGPU", () => {
    const preset: ParticlePreset = {
      simulation: "gpu",
      maxParticles: 512,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 1, size: 1, color: "#fff", velocity: [1, 0, 0] },
      renderer: {
        texture: makeTexture(),
        type: "stretchedBillboard",
        align: "velocity",
        stretchFactor: 0.35,
        stretchMaxScale: 4,
        sorting: "none",
      },
    };

    const rows = compareParticlePresetBackends(preset);
    const webgl = rows.find((row) => row.target === "webgl");
    const webgpu = rows.find((row) => row.target === "webgpu");

    expect(webgl?.selection).toMatchObject({ simulation: "cpu", reason: "stretchedBillboard" });
    expect(webgl?.issueLabels).toContain("fallback: stretched billboard");
    expect(webgpu?.selection).toMatchObject({ simulation: "gpu", backend: "webgpu" });
  });

  it("keeps disc emitter available on both GPU targets", () => {
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "auto" },
      maxParticles: 512,
      emitter: { type: "disc", radius: 0.3, emitFrom: "volume" },
      emission: { rateOverTime: 20 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#fff" },
      renderer: { texture: makeTexture(), sorting: "none" },
    };

    const rows = compareParticlePresetBackends(preset);
    expect(rows.find((row) => row.target === "webgl")?.errors).toEqual([]);
    expect(rows.find((row) => row.target === "webgpu")?.errors).toEqual([]);
  });

  it("keeps unsupported CPU-only modules visible in comparison rows", () => {
    const preset: ParticlePreset = {
      simulation: "gpu",
      maxParticles: 4096,
      emitter: { type: "point" },
      emission: { rateOverTime: 10 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#fff" },
      collision: { type: "plane", y: 0 },
      renderer: { texture: makeTexture() },
    };

    const rows = compareParticlePresetBackends(preset);

    expect(rows.find((row) => row.target === "webgl")?.selection).toMatchObject({ simulation: "cpu", reason: "collision" });
    expect(rows.find((row) => row.target === "webgpu")?.selection).toMatchObject({ simulation: "cpu", reason: "collision" });
    expect(rows.find((row) => row.target === "webgpu")?.issueLabels).toContain("fallback: collision");
  });

  it("labels common GPU warning causes compactly", () => {
    const preset: ParticlePreset = {
      simulation: "gpu",
      maxParticles: 4096,
      emitter: { type: "point" },
      emission: { rateOverTime: 10 },
      start: { lifetime: 1, speed: 1, size: 1, color: "#fff" },
      renderer: { texture: makeTexture(), sorting: "distance" },
    };

    const rows = compareParticlePresetBackends(preset);
    const webgpu = rows.find((row) => row.target === "webgpu");

    expect(webgpu?.issueLabels).toEqual(expect.arrayContaining(["experimental", "sorting ignored"]));
  });
});
