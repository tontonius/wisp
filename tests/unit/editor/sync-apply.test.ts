/** @vitest-environment happy-dom */

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createSafePresetSerializer } from "../../../editor/lib/preset-io.js";
import { clonePreset } from "../../../editor/lib/preset-utils.js";
import { applyParamsToPreset, syncParamsFromPreset } from "../../../editor/state/preset-bridge.js";
import { createInitialEditorParams } from "../../../editor/state/params.js";
import type { ParticlePreset } from "../../../src";

function stableStringify(preset: ParticlePreset): string {
  return JSON.stringify(preset, createSafePresetSerializer());
}

function stubTexture(): THREE.Texture {
  const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

describe("syncParamsFromPreset / applyParamsToPreset", () => {
  it("is idempotent for a representative GPU-style preset", () => {
    const softDisc = stubTexture();
    const hardDisc = stubTexture();
    const spark = stubTexture();

    const workingPreset = clonePreset({
      simulation: "cpu",
      gpu: { backend: "webgpu" },
      simulationSpace: "local",
      maxParticles: 128,
      duration: 2,
      loop: true,
      prewarm: false,
      emitter: { type: "cone", radius: 0.2, angle: 30, length: 1 },
      emission: { rateOverTime: 12 },
      start: {
        lifetime: [0.5, 1],
        speed: [0.5, 2],
        size: [0.5, 1],
        color: "#ffeedd",
        opacity: [0.8, 1],
      },
      forces: {
        drag: 0.2,
        acceleration: [0, 0.1, 0],
        noise: { strength: 0.1, frequency: 4 },
      },
      renderer: {
        texture: hardDisc,
        blendMode: "alpha",
        align: "camera",
        sorting: "distance",
        depthWrite: false,
      },
    } satisfies ParticlePreset as ParticlePreset);

    const params = createInitialEditorParams();
    const customRendererTexture = { value: undefined as THREE.Texture | undefined };
    const customDispersalTexture = { value: undefined as THREE.Texture | undefined };
    let refreshCalls = 0;
    const ctx = {
      params,
      workingPreset,
      softDisc,
      hardDisc,
      spark,
      customRendererTexture,
      customDispersalTexture,
      refreshExportJson: () => {
        refreshCalls++;
      },
    };

    syncParamsFromPreset(ctx);
    expect(params.gpuBackend).toBe("webgpu");
    applyParamsToPreset(ctx);
    expect(workingPreset.gpu?.backend).toBe("webgpu");
    syncParamsFromPreset(ctx);
    const stable = stableStringify(workingPreset);
    applyParamsToPreset(ctx);
    syncParamsFromPreset(ctx);
    expect(stableStringify(workingPreset)).toBe(stable);
    expect(refreshCalls).toBeGreaterThan(0);
  });
});
