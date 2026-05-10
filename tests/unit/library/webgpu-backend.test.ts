import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import "../../../src/webgpu";
import { ParticleSystem } from "../../../src";
import { resolveRendererTexture } from "../../../src/particles/shared";
import type { ParticlePreset, ParticleRenderer } from "../../../src";

function makeTexture(): THREE.DataTexture {
  const data = new Uint8Array([255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

describe("WebGPUParticleBackend v0", () => {
  it("accepts alphaFromLuminance when the texture cannot be canvas-keyed in the current runtime", () => {
    const texture = makeTexture();

    expect(() =>
      resolveRendererTexture({
        texture,
        alphaFromLuminance: { enabled: true, blackCutoff: 32 },
      })
    ).not.toThrow();
    expect(
      resolveRendererTexture({
        texture,
        alphaFromLuminance: { enabled: true, blackCutoff: 32 },
      })
    ).toBe(texture);
  });

  it("selects WebGPU and renders spawned particles as live instances", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 8,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 3 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    system.play();
    system.update(1 / 60, camera);

    expect(system.backendType).toBe("gpu");
    expect(system.gpuBackendType).toBe("webgpu");
    expect(system.computeMode).toBe("sidecar");
    expect(system.aliveCount).toBe(3);
    expect(system.isAlive).toBe(true);
    expect(renderer.compute).toHaveBeenCalled();

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("uses the authoritative TSL path when storage-buffer readback is available", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 4,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, size: 1.5, color: "#ffffff" },
      overLifetime: {
        size: [[0, 0.5], [1, 0.5]],
        opacity: [[0, 0.25], [1, 0.25]],
      },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        object: THREE.Object3D;
        mesh: THREE.InstancedMesh;
        positionAgeNode: { value: THREE.BufferAttribute };
        velocityLifeNode: { value: THREE.BufferAttribute };
        stateNode: { value: THREE.BufferAttribute };
        renderStateData: Float32Array;
        tslCameraRightUniform: { value: THREE.Vector3 };
        tslCameraUpUniform: { value: THREE.Vector3 };
        tslCameraForwardUniform: { value: THREE.Vector3 };
      };
    };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(1 / 60, camera);
    system.update(0, camera);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const mesh = backend.backend.mesh;

    expect(system.computeMode).toBe("authoritative");
    expect(system.motionMode).toBe("motion-readback-bridge");
    expect(renderer.getArrayBufferAsync).toHaveBeenCalledTimes(2);
    expect(renderer.getArrayBufferAsync).toHaveBeenNthCalledWith(1, backend.backend.positionAgeNode.value);
    expect(renderer.getArrayBufferAsync).toHaveBeenNthCalledWith(2, backend.backend.velocityLifeNode.value);
    expect(renderer.getArrayBufferAsync).not.toHaveBeenCalledWith(backend.backend.stateNode.value);
    expect(system.aliveCount).toBe(1);
    expect(mesh.material).toMatchObject({
      isMeshBasicNodeMaterial: true,
      positionNode: expect.any(Object),
      opacityNode: expect.any(Object),
    });
    expect(mesh.count).toBe(4);
    expect(backend.backend.stateNode.value.array[1]).toBe(1.5);
    expect(backend.backend.renderStateData[1]).toBeCloseTo(0.75);
    expect(backend.backend.renderStateData[3]).toBeCloseTo(0.25);
    backend.backend.object.rotation.z = Math.PI / 2;
    backend.backend.object.updateMatrixWorld(true);
    (backend.backend as unknown as { updateTslCameraBasis: (camera: THREE.Camera) => void }).updateTslCameraBasis(camera);
    expect(backend.backend.tslCameraRightUniform.value.length()).toBeCloseTo(1);
    expect(backend.backend.tslCameraUpUniform.value.length()).toBeCloseTo(1);
    expect(backend.backend.tslCameraForwardUniform.value.length()).toBeCloseTo(1);
    expect(backend.backend.tslCameraRightUniform.value.x).toBeCloseTo(0);
    expect(backend.backend.tslCameraRightUniform.value.y).toBeCloseTo(-1);
    expect(backend.backend.tslCameraUpUniform.value.x).toBeCloseTo(1);
    expect(backend.backend.tslCameraUpUniform.value.y).toBeCloseTo(0);
    expect(mesh.instanceColor?.getX(0)).toBeCloseTo(1);
    expect(mesh.instanceColor?.getY(0)).toBeCloseTo(1);
    expect(mesh.instanceColor?.getZ(0)).toBeCloseTo(1);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("stretches CPU-mirror fallback billboards along velocity", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 2,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, velocity: [1, 0, 0], size: 1, color: "#ffffff" },
      renderer: {
        texture: makeTexture(),
        type: "stretchedBillboard",
        align: "velocity",
        stretchFactor: 2,
        stretchMaxScale: 4,
      },
    };

    const system = new ParticleSystem(preset, { renderer });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    system.play();
    system.update(0, camera);
    const backend = system as unknown as { backend: { mesh: THREE.InstancedMesh } };
    const mesh = backend.backend.mesh;
    const matrix = new THREE.Matrix4();
    const stretchedAxis = new THREE.Vector3();
    const regularAxis = new THREE.Vector3();

    mesh.getMatrixAt(0, matrix);
    stretchedAxis.setFromMatrixColumn(matrix, 0);
    regularAxis.setFromMatrixColumn(matrix, 1);

    expect(system.computeMode).toBe("sidecar");
    expect(mesh.count).toBe(1);
    expect(stretchedAxis.length()).toBeCloseTo(3);
    expect(regularAxis.length()).toBeCloseTo(1);
    expect(Math.abs(stretchedAxis.normalize().dot(new THREE.Vector3(1, 0, 0)))).toBeCloseTo(1);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("tracks authoritative lifecycle without state readback", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 0.05, speed: 0, size: 1, color: "#ffffff" },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0, camera);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(system.aliveCount).toBe(1);
    expect(system.motionMode).toBe("motion-readback-bridge");

    system.update(0.1, camera);
    const backend = system as unknown as { backend: { stateData: Float32Array; renderStateData: Float32Array; particles: Array<{ alive: boolean }> } };
    expect(system.aliveCount).toBe(0);
    expect(backend.backend.particles[0]?.alive).toBe(false);
    expect(backend.backend.stateData[0]).toBe(0);
    expect(backend.backend.renderStateData[0]).toBe(0);
    expect(renderer.getArrayBufferAsync).toHaveBeenCalledTimes(2);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("feeds texture sheet frames into the authoritative TSL material", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 2,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      renderer: {
        texture: makeTexture(),
        textureSheet: { columns: 2, rows: 2, animationMode: "overLifetime" },
      },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        renderFrameData: Float32Array;
        renderFrameNode: { value: THREE.BufferAttribute };
      };
    };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0.5, camera);
    const backendObject = system.children[0] as THREE.Object3D;
    const mesh = backendObject.children[0] as THREE.InstancedMesh;

    expect(system.computeMode).toBe("authoritative");
    expect((mesh.material as { isMeshBasicNodeMaterial?: boolean; colorNode?: unknown }).isMeshBasicNodeMaterial).toBe(true);
    expect((mesh.material as { colorNode?: unknown }).colorNode).toEqual(expect.any(Object));
    expect(backend.backend.renderFrameData[0]).toBe(2);
    expect(backend.backend.renderFrameNode.value.version).toBeGreaterThan(0);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("builds dispersal opacity nodes and metadata for authoritative TSL billboards", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      renderer: {
        texture: makeTexture(),
        dispersal: {
          strength: 1,
          amount: [[0, 0], [1, 1]],
        },
      },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        dispersalAmountCurveTexture: THREE.DataTexture | null;
        renderFrameData: Float32Array;
      };
    };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0.5, camera);
    const backendObject = system.children[0] as THREE.Object3D;
    const mesh = backendObject.children[0] as THREE.InstancedMesh;

    expect(system.computeMode).toBe("authoritative");
    expect(backend.backend.dispersalAmountCurveTexture).toBeTruthy();
    expect((mesh.material as { opacityNode?: unknown }).opacityNode).toEqual(expect.any(Object));
    expect(backend.backend.renderFrameData[1]).toBeCloseTo(0.5);
    expect(backend.backend.renderFrameData[2]).toBeGreaterThanOrEqual(0);
    expect(backend.backend.renderFrameData[2]).toBeLessThan(1);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("accepts a dispersal texture map in the authoritative TSL path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const dispersalMap = makeTexture();
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      renderer: {
        texture: makeTexture(),
        dispersal: {
          texture: dispersalMap,
          strength: 1,
          amount: [[0, 0], [1, 1]],
        },
      },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        dispersalAmountCurveTexture: THREE.DataTexture | null;
      };
    };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    expect(() => system.update(0.25, camera)).not.toThrow();
    expect(backend.backend.dispersalAmountCurveTexture).toBeTruthy();

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("wires soft particle depth texture into the authoritative TSL opacity path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const depthTexture = makeTexture();
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      renderer: {
        texture: makeTexture(),
        softParticles: true,
        softness: 2.5,
      },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        softParticleDepthNode?: { value: THREE.Texture };
        softParticleEnabledUniform: { value: number };
        softParticleSoftnessUniform: { value: number };
        softParticleDepthPlaceholder: THREE.DataTexture;
      };
    };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0, camera);
    system.setSoftParticleDepthTexture(depthTexture, { width: 4, height: 4 });

    expect(system.computeMode).toBe("authoritative");
    expect(backend.backend.softParticleDepthNode?.value).toBe(depthTexture);
    expect(backend.backend.softParticleEnabledUniform.value).toBe(1);
    expect(backend.backend.softParticleSoftnessUniform.value).toBe(2.5);

    system.setSoftParticleDepthTexture(null);
    expect(backend.backend.softParticleDepthNode?.value).toBe(backend.backend.softParticleDepthPlaceholder);
    expect(backend.backend.softParticleEnabledUniform.value).toBe(0);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("applies colorBySpeed to authoritative TSL instance colors", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, velocity: [2, 0, 0], size: 1, color: "#ffffff" },
      colorBySpeed: {
        speedRange: [0, 2],
        gradient: [[0, "#0000ff"], [1, "#ff0000"]],
      },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0, camera);
    const backendObject = system.children[0] as THREE.Object3D;
    const mesh = backendObject.children[0] as THREE.InstancedMesh;

    expect(system.computeMode).toBe("authoritative");
    expect(mesh.instanceColor?.getX(0)).toBeCloseTo(1);
    expect(mesh.instanceColor?.getY(0)).toBeCloseTo(0);
    expect(mesh.instanceColor?.getZ(0)).toBeCloseTo(0);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("applies sizeBySpeed to authoritative TSL render size", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, velocity: [2, 0, 0], size: 1.5, color: "#ffffff" },
      overLifetime: {
        size: [[0, 2], [1, 2]],
      },
      sizeBySpeed: {
        speedRange: [0, 2],
        curve: [[0, 1], [1, 3]],
      },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as { backend: { renderStateData: Float32Array } };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0, camera);

    expect(system.computeMode).toBe("authoritative");
    expect(backend.backend.renderStateData[1]).toBeCloseTo(9);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("applies rotationBySpeed to authoritative TSL render rotation", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, velocity: [2, 0, 0], size: 1, rotation: 0, angularVelocity: 0, color: "#ffffff" },
      rotationBySpeed: {
        speedRange: [0, 2],
        angularVelocity: [[0, 0], [1, 229]],
      },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as { backend: { renderStateData: Float32Array } };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0.25, camera);

    expect(system.computeMode).toBe("authoritative");
    expect(backend.backend.renderStateData[2]).toBeCloseTo(1);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("passes pointAttractor uniforms into the WebGPU compute path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      forces: {
        pointAttractor: {
          center: [1, 2, 3],
          strength: 4,
          epsilon: 0.25,
        },
      },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        computePointAttractorEnabledUniform: { value: number };
        computePointAttractorCenterUniform: { value: THREE.Vector3 };
        computePointAttractorStrengthUniform: { value: number };
        computePointAttractorEpsilonUniform: { value: number };
      };
    };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0, camera);

    expect(system.computeMode).toBe("authoritative");
    expect(backend.backend.computePointAttractorEnabledUniform.value).toBe(1);
    expect(backend.backend.computePointAttractorCenterUniform.value.toArray()).toEqual([1, 2, 3]);
    expect(backend.backend.computePointAttractorStrengthUniform.value).toBe(4);
    expect(backend.backend.computePointAttractorEpsilonUniform.value).toBe(0.25);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("builds a pointAttractor strengthOverLifetime curve texture for WebGPU compute", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      forces: {
        pointAttractor: {
          center: [0, 1, 0],
          strength: 1,
          strengthOverLifetime: [[0, 0.25], [1, 2]],
        },
      },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        pointAttractorStrengthCurveTexture: THREE.DataTexture;
      };
    };

    const data = backend.backend.pointAttractorStrengthCurveTexture.image.data as Float32Array;
    expect(data[0]).toBeCloseTo(0.25);
    expect(data[(256 - 1) * 4]).toBeCloseTo(2);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("passes normalized vortex uniforms into the WebGPU compute path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      forces: {
        vortex: {
          center: [1, 2, 3],
          axis: [0, 2, 0],
          orbitalSpeed: 4,
          inward: 5,
          upward: 6,
        },
      },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        computeVortexEnabledUniform: { value: number };
        computeVortexCenterUniform: { value: THREE.Vector3 };
        computeVortexAxisUniform: { value: THREE.Vector3 };
        computeVortexOrbitalSpeedUniform: { value: number };
        computeVortexInwardUniform: { value: number };
        computeVortexUpwardUniform: { value: number };
      };
    };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0, camera);

    expect(system.computeMode).toBe("authoritative");
    expect(backend.backend.computeVortexEnabledUniform.value).toBe(1);
    expect(backend.backend.computeVortexCenterUniform.value.toArray()).toEqual([1, 2, 3]);
    expect(backend.backend.computeVortexAxisUniform.value.toArray()).toEqual([0, 1, 0]);
    expect(backend.backend.computeVortexOrbitalSpeedUniform.value).toBe(4);
    expect(backend.backend.computeVortexInwardUniform.value).toBe(5);
    expect(backend.backend.computeVortexUpwardUniform.value).toBe(6);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("passes noise uniforms into the WebGPU compute path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      forces: {
        noise: {
          strength: 1.5,
          frequency: 3,
          scroll: [0.1, 0.2, 0.3],
          octaves: 4,
          lacunarity: 2.5,
          persistence: 0.75,
        },
      },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        computeNoiseStrengthUniform: { value: number };
        computeNoiseFrequencyUniform: { value: number };
        computeNoiseScrollUniform: { value: THREE.Vector3 };
        computeNoiseOctavesUniform: { value: number };
        computeNoiseLacunarityUniform: { value: number };
        computeNoisePersistenceUniform: { value: number };
      };
    };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0.25, camera);

    expect(system.computeMode).toBe("authoritative");
    expect(backend.backend.computeNoiseStrengthUniform.value).toBe(1.5);
    expect(backend.backend.computeNoiseFrequencyUniform.value).toBe(3);
    expect(backend.backend.computeNoiseScrollUniform.value.toArray()).toEqual([0.1, 0.2, 0.3]);
    expect(backend.backend.computeNoiseOctavesUniform.value).toBe(4);
    expect(backend.backend.computeNoiseLacunarityUniform.value).toBe(2.5);
    expect(backend.backend.computeNoisePersistenceUniform.value).toBe(0.75);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("passes limitVelocityOverLifetime uniforms and curve into the WebGPU compute path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 1, speed: 3, size: 1, color: "#ffffff" },
      limitVelocityOverLifetime: {
        speed: [[0, 2], [1, 1]],
        dampen: 0.5,
      },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as {
      backend: {
        computeVelocityLimitEnabledUniform: { value: number };
        computeVelocityLimitDampenUniform: { value: number };
        velocityLimitSpeedCurveTexture: THREE.DataTexture;
      };
    };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0.25, camera);

    expect(system.computeMode).toBe("authoritative");
    expect(backend.backend.computeVelocityLimitEnabledUniform.value).toBe(1);
    expect(backend.backend.computeVelocityLimitDampenUniform.value).toBe(0.5);
    expect(backend.backend.velocityLimitSpeedCurveTexture).toBeInstanceOf(THREE.DataTexture);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("does not re-upload GPU-owned motion buffers when lifecycle kills a slot", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = {
      isWebGPURenderer: true,
      compute: vi.fn(),
      getArrayBufferAsync: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as unknown as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 1,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 1 }] },
      start: { lifetime: 0.05, speed: 0, size: 1, color: "#ffffff" },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    system.update(0, camera);
    const backend = system as unknown as {
      backend: {
        positionAgeNode: { value: THREE.BufferAttribute };
        velocityLifeNode: { value: THREE.BufferAttribute };
        stateNode: { value: THREE.BufferAttribute };
        renderStateNode: { value: THREE.BufferAttribute };
      };
    };
    const positionAgeVersion = backend.backend.positionAgeNode.value.version;
    const velocityLifeVersion = backend.backend.velocityLifeNode.value.version;
    const stateVersion = backend.backend.stateNode.value.version;
    const renderStateVersion = backend.backend.renderStateNode.value.version;

    system.update(0.1, camera);
    system.update(0, camera);

    expect(backend.backend.positionAgeNode.value.version).toBe(positionAgeVersion);
    expect(backend.backend.velocityLifeNode.value.version).toBe(velocityLifeVersion);
    expect(backend.backend.stateNode.value.version).toBeGreaterThan(stateVersion);
    expect(backend.backend.renderStateNode.value.version).toBeGreaterThan(renderStateVersion);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("keeps rendering when the renderer does not expose compute yet", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = { isWebGPURenderer: true } as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu" },
      maxParticles: 4,
      duration: 1,
      emitter: { type: "point" },
      emission: { bursts: [{ time: 0, count: 2 }] },
      start: { lifetime: 1, speed: 0, size: 1, color: "#ffffff" },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    system.play();
    expect(() => system.update(1 / 60, camera)).not.toThrow();
    expect(system.backendType).toBe("gpu");
    expect(system.gpuBackendType).toBe("webgpu");
    expect(system.computeMode).toBe("unavailable");
    expect(system.motionMode).toBe("cpu-mirror");
    expect(system.aliveCount).toBe(2);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });

  it("uses a wrapping spawn cursor for predictable WebGPU slot uploads", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderer = { isWebGPURenderer: true } as ParticleRenderer;
    const preset: ParticlePreset = {
      simulation: "gpu",
      gpu: { backend: "webgpu", maxSpawnPerFrame: 3 },
      maxParticles: 3,
      duration: 1,
      emitter: { type: "point" },
      start: { lifetime: 10, speed: 0, size: 1, color: "#ffffff" },
      renderer: { texture: makeTexture() },
    };

    const system = new ParticleSystem(preset, { renderer });
    const backend = system as unknown as { backend: { spawnCursor: number; particles: Array<{ alive: boolean }> } };

    system.emit(3);
    expect(system.aliveCount).toBe(3);
    expect(backend.backend.spawnCursor).toBe(0);
    expect(backend.backend.particles.map((particle) => particle.alive)).toEqual([true, true, true]);

    system.emit(2);
    expect(system.aliveCount).toBe(3);
    expect(backend.backend.spawnCursor).toBe(2);
    expect(backend.backend.particles.map((particle) => particle.alive)).toEqual([true, true, true]);

    system.stop();
    expect(system.aliveCount).toBe(0);
    expect(backend.backend.spawnCursor).toBe(0);

    system.dispose({ disposeTexture: true });
    warn.mockRestore();
  });
});
