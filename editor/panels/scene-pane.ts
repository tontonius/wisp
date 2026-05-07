import * as THREE from "three";
import { Pane } from "tweakpane";
import type { PanelRuntime } from "../panel-runtime";

export function installScenePane(rt: PanelRuntime, host: HTMLDivElement): void {
  function applySceneFog(): void {
    const near = Math.max(0, Math.min(rt.sceneParams.fogNearFar.x, rt.sceneParams.fogNearFar.y));
    const far = Math.max(near + 0.001, rt.sceneParams.fogNearFar.y);
    rt.sceneParams.fogNearFar.x = near;
    rt.sceneParams.fogNearFar.y = far;
    rt.scene.fog = rt.sceneParams.fogEnabled ? new THREE.Fog(rt.sceneParams.fogColor, near, far) : null;
  }

  const scenePane = new Pane({ title: "Scene", expanded: false, container: host });
  rt.scenePane = scenePane;
  scenePane
    .addBinding(rt, "editorViewMode", {
      label: "Editor View",
      options: {
        Particles: "particles",
        "Motion Test": "motionTest",
      },
    })
    .on("change", (ev) => {
      rt.setEditorViewMode(ev.value);
    });
  scenePane.addBinding(rt.sceneParams, "groundVisible", { label: "Ground Plane" }).on("change", () => {
    rt.floor.visible = rt.sceneParams.groundVisible;
  });
  scenePane.addBinding(rt.sceneParams, "groundColor", { label: "Ground Color" }).on("change", () => {
    rt.floorMaterial.color.set(rt.sceneParams.groundColor);
  });
  scenePane.addBinding(rt.sceneParams, "backgroundColor", { label: "Background" }).on("change", () => {
    rt.scene.background = new THREE.Color(rt.sceneParams.backgroundColor);
  });

  const fogFolder = scenePane.addFolder({ title: "Fog", expanded: false });
  fogFolder.addBinding(rt.sceneParams, "fogEnabled", { label: "Enabled" }).on("change", applySceneFog);
  fogFolder.addBinding(rt.sceneParams, "fogColor", { label: "Color" }).on("change", applySceneFog);
  fogFolder
    .addBinding(rt.sceneParams, "fogNearFar", {
      label: "Near/Far",
      x: { min: 0, max: 1000, step: 0.01 },
      y: { min: 0, max: 1000, step: 0.01 },
    })
    .on("change", applySceneFog);

  applySceneFog();
}
