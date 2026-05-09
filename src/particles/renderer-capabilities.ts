import * as THREE from "three";
import type { ParticlePreset, ParticleRenderer, ResolvedGpuBackend } from "./types";

export type ParticleBackendSelection =
  | { simulation: "cpu"; reason?: string }
  | { simulation: "gpu"; backend: ResolvedGpuBackend };

export function isWebGPURenderer(renderer: ParticleRenderer | undefined): boolean {
  return !!renderer && (renderer as { isWebGPURenderer?: boolean }).isWebGPURenderer === true;
}

export function isWebGLRenderer(renderer: ParticleRenderer | undefined): renderer is THREE.WebGLRenderer {
  return !!renderer && (renderer as { isWebGLRenderer?: boolean }).isWebGLRenderer === true;
}

export function resolveRendererGpuBackend(renderer: ParticleRenderer | undefined): ResolvedGpuBackend | undefined {
  if (isWebGPURenderer(renderer)) return "webgpu";
  if (isWebGLRenderer(renderer)) return "webgl";
  return undefined;
}

export function selectParticleBackend(preset: ParticlePreset, renderer: ParticleRenderer | undefined): ParticleBackendSelection {
  if (preset.gpu?.forceCpuFallback) return { simulation: "cpu", reason: "gpu.forceCpuFallback" };
  if (preset.collision) return { simulation: "cpu", reason: "collision" };
  if (preset.subEmitters) return { simulation: "cpu", reason: "subEmitters" };
  if (preset.simulation === "cpu") return { simulation: "cpu", reason: "simulation" };
  if (preset.simulation !== "gpu" && preset.simulation !== "auto") return { simulation: "cpu", reason: "default" };

  const preferred = preset.gpu?.backend ?? "auto";
  const rendererBackend = resolveRendererGpuBackend(renderer);

  if (preset.simulation === "auto" && (preset.maxParticles ?? 0) < 2048) {
    return { simulation: "cpu", reason: "capacity" };
  }

  if (!rendererBackend) return { simulation: "cpu", reason: "missingRenderer" };
  const selectedBackend = preferred === "auto" ? rendererBackend : preferred === rendererBackend ? preferred : undefined;
  if (!selectedBackend) return { simulation: "cpu", reason: `renderer:${rendererBackend}:requested:${preferred}` };
  if (preset.renderer?.type === "stretchedBillboard" && selectedBackend !== "webgpu") return { simulation: "cpu", reason: "stretchedBillboard" };

  return { simulation: "gpu", backend: selectedBackend };
}
