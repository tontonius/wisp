import type { ParticlePreset, ParticleRenderer, ResolvedGpuBackend, SimulationMode } from "./types";
import { collectParticlePresetIssues } from "../particle-preset-validation";
import { selectParticleBackend, type ParticleBackendSelection } from "./renderer-capabilities";

export type ParticleBackendComparisonTarget = "cpu" | ResolvedGpuBackend;

export type ParticleBackendComparisonRow = {
  target: ParticleBackendComparisonTarget;
  presetSimulation: SimulationMode;
  requestedGpuBackend?: "webgl" | "webgpu";
  selection: ParticleBackendSelection;
  errors: string[];
  warnings: string[];
  issueLabels: string[];
};

const webglRendererStub = { isWebGLRenderer: true } as unknown as ParticleRenderer;
const webgpuRendererStub = { isWebGPURenderer: true } as unknown as ParticleRenderer;

function rendererForTarget(target: ParticleBackendComparisonTarget): ParticleRenderer | undefined {
  if (target === "webgl") return webglRendererStub;
  if (target === "webgpu") return webgpuRendererStub;
  return undefined;
}

function presetForTarget(preset: ParticlePreset, target: ParticleBackendComparisonTarget): ParticlePreset {
  if (target === "cpu") {
    return {
      ...preset,
      simulation: "cpu",
    };
  }

  return {
    ...preset,
    simulation: "gpu",
    gpu: {
      ...(preset.gpu ?? {}),
      backend: target,
    },
  };
}

function fallbackLabel(reason: string | undefined): string {
  switch (reason) {
    case "collision":
      return "fallback: collision";
    case "subEmitters":
      return "fallback: sub-emitters";
    case "stretchedBillboard":
      return "fallback: stretched billboard";
    case "gpu.forceCpuFallback":
      return "fallback: forced CPU";
    case "missingRenderer":
      return "fallback: missing renderer";
    case "capacity":
      return "fallback: capacity";
    case "simulation":
      return "CPU selected";
    default:
      return reason ? `fallback: ${reason}` : "fallback: CPU";
  }
}

function issueLabel(issue: string): string {
  if (issue.includes('gpu.backend "webgpu" is experimental')) return "experimental";
  if (issue.includes("renderer.sorting")) return "sorting ignored";
  if (issue.includes("callbacks.onParticleBirth")) return "birth callbacks ignored";
  if (issue.includes("callbacks.onParticleDeath")) return "death callbacks ignored";
  if (issue.includes("callbacks.onParticleCollision")) return "collision callbacks ignored";
  if (issue.includes("subEmitters.onBirth")) return "birth sub-emitters ignored";
  if (issue.includes("subEmitters.onDeath")) return "death sub-emitters ignored";
  if (issue.includes("subEmitters.onCollision")) return "collision sub-emitters ignored";
  if (issue.includes("inheritVelocity")) return "inherit velocity ignored";
  if (issue.includes("lifetimeByEmitterSpeed")) return "lifetime by speed ignored";
  if (issue.includes("provided renderer cannot satisfy")) return "renderer mismatch";
  return issue.length > 48 ? `${issue.slice(0, 45)}...` : issue;
}

function issueLabelsForRow(row: Omit<ParticleBackendComparisonRow, "issueLabels">): string[] {
  const labels = new Set<string>();
  if (row.target !== "cpu" && row.selection.simulation === "cpu") {
    labels.add(fallbackLabel(row.selection.reason));
  }
  for (const error of row.errors) labels.add(`error: ${issueLabel(error)}`);
  for (const warning of row.warnings) labels.add(issueLabel(warning));
  return [...labels];
}

export function compareParticlePresetBackends(
  preset: ParticlePreset,
  targets: ParticleBackendComparisonTarget[] = ["cpu", "webgl", "webgpu"]
): ParticleBackendComparisonRow[] {
  return targets.map((target) => {
    const targetPreset = presetForTarget(preset, target);
    const renderer = rendererForTarget(target);
    const issues = collectParticlePresetIssues(targetPreset, { renderer });
    const row = {
      target,
      presetSimulation: targetPreset.simulation ?? "auto",
      requestedGpuBackend: target === "cpu" ? undefined : target,
      selection: selectParticleBackend(targetPreset, renderer),
      errors: issues.errors,
      warnings: issues.warnings,
    };
    return {
      ...row,
      issueLabels: issueLabelsForRow(row),
    };
  });
}
