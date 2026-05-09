import type { ParticleBackend, ParticlePreset, WebGPURendererLike } from "./types";

export type WebGPUBackendFactory = (preset: ParticlePreset, renderer: WebGPURendererLike) => ParticleBackend;

let registeredWebGPUBackendFactory: WebGPUBackendFactory | undefined;

export function registerWebGPUBackend(factory: WebGPUBackendFactory): void {
  registeredWebGPUBackendFactory = factory;
}

export function hasRegisteredWebGPUBackend(): boolean {
  return registeredWebGPUBackendFactory !== undefined;
}

export function createRegisteredWebGPUBackend(preset: ParticlePreset, renderer: WebGPURendererLike): ParticleBackend | undefined {
  return registeredWebGPUBackendFactory?.(preset, renderer);
}
