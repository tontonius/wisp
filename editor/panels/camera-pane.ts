import * as THREE from "three";
import { Pane } from "tweakpane";
import * as EssentialsPlugin from "@tweakpane/plugin-essentials";
import type { PanelRuntime } from "../panel-runtime";

export function installCameraPane(rt: PanelRuntime, host: HTMLDivElement): void {
  const cameraPane = new Pane({ title: "Camera FX", expanded: true, container: host });
  cameraPane.registerPlugin(EssentialsPlugin);
  rt.cameraPane = cameraPane;

  function applyCameraShakeConfig(): void {
    rt.wisp.camera.configureShake({
      decayRate: rt.cameraShakeParams.decayRate,
      traumaExponent: rt.cameraShakeParams.traumaExponent,
      noiseFrequency: rt.cameraShakeParams.noiseFrequency,
      mode: rt.cameraShakeParams.mode,
      maxRotation: [
        THREE.MathUtils.degToRad(rt.cameraShakeParams.maxPitchDeg),
        THREE.MathUtils.degToRad(rt.cameraShakeParams.maxYawDeg),
        THREE.MathUtils.degToRad(rt.cameraShakeParams.maxRollDeg),
      ],
      maxTranslation: [
        rt.cameraShakeParams.maxTranslation.x,
        rt.cameraShakeParams.maxTranslation.y,
        rt.cameraShakeParams.maxTranslation.z,
      ],
    });
  }

  const shakeFolder = cameraPane.addFolder({ title: "Camera shake", expanded: true });
  shakeFolder.addButton({ title: "Shake camera" }).on("click", () => {
    if (!rt.cameraShakeParams.enabled) return;
    rt.wisp.camera.shake(rt.cameraShakeParams.triggerTrauma);
  });
  shakeFolder.addBinding(rt.cameraShakeParams, "enabled", { label: "Enabled" });
  shakeFolder.addBinding(rt.cameraShakeParams, "onRespawn", { label: "On respawn" });
  shakeFolder.addBinding(rt.cameraShakeParams, "triggerTrauma", {
    label: "Trigger trauma",
    min: 0,
    max: 1,
    step: 0.01,
  });
  shakeFolder
    .addBinding(rt.cameraShakeParams, "decayRate", {
      label: "Decay",
      min: 0.1,
      max: 5,
      step: 0.01,
    })
    .on("change", applyCameraShakeConfig);
  shakeFolder
    .addBinding(rt.cameraShakeParams, "traumaExponent", {
      label: "Power",
      min: 1,
      max: 4,
      step: 0.1,
    })
    .on("change", applyCameraShakeConfig);
  shakeFolder
    .addBinding(rt.cameraShakeParams, "noiseFrequency", {
      label: "Noise Hz",
      min: 1,
      max: 60,
      step: 0.1,
    })
    .on("change", applyCameraShakeConfig);
  shakeFolder
    .addBinding(rt.cameraShakeParams, "mode", {
      label: "Mode",
      options: {
        rotationOnly: "rotationOnly",
        rotationAndTranslation: "rotationAndTranslation",
      },
    })
    .on("change", applyCameraShakeConfig);
  shakeFolder
    .addBinding(rt.cameraShakeParams, "maxPitchDeg", {
      label: "Max pitch",
      min: 0,
      max: 10,
      step: 0.1,
    })
    .on("change", applyCameraShakeConfig);
  shakeFolder
    .addBinding(rt.cameraShakeParams, "maxYawDeg", {
      label: "Max yaw",
      min: 0,
      max: 10,
      step: 0.1,
    })
    .on("change", applyCameraShakeConfig);
  shakeFolder
    .addBinding(rt.cameraShakeParams, "maxRollDeg", {
      label: "Max roll",
      min: 0,
      max: 12,
      step: 0.1,
    })
    .on("change", applyCameraShakeConfig);
  shakeFolder
    .addBinding(rt.cameraShakeParams, "maxTranslation", {
      label: "Max xyz",
      x: { min: 0, max: 0.2, step: 0.001 },
      y: { min: 0, max: 0.2, step: 0.001 },
      z: { min: 0, max: 0.2, step: 0.001 },
    })
    .on("change", applyCameraShakeConfig);
  shakeFolder.addButton({ title: "Reset shake" }).on("click", () => {
    rt.wisp.camera.reset();
    rt.cameraRuntime.trauma = rt.wisp.camera.trauma;
    rt.cameraPane.refresh();
  });

  cameraPane.addBinding(rt.cameraRuntime, "trauma", {
    readonly: true,
    label: "Trauma",
    view: "graph",
    min: 0,
    max: 1,
  });

  applyCameraShakeConfig();
}
