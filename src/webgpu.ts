import { WebGPUParticleBackend } from "./particles/backends/webgpu-backend";
import { registerWebGPUBackend } from "./particles/webgpu-registry";

registerWebGPUBackend((preset, renderer) => new WebGPUParticleBackend(preset, renderer));

export { WebGPUParticleBackend } from "./particles/backends/webgpu-backend";
export { registerWebGPUBackend } from "./particles/webgpu-registry";
export type { WebGPUBackendFactory } from "./particles/webgpu-registry";
