import * as THREE from "three";
import { Pane } from "tweakpane";
import type { PanelRuntime } from "../panel-runtime";

export function installScenePane(rt: PanelRuntime, host: HTMLDivElement): void {
  const scenePane = new Pane({ title: "Scene", expanded: false, container: host });
  rt.scenePane = scenePane;
  scenePane.addBinding(rt.sceneParams, "groundVisible", { label: "Ground Plane" }).on("change", () => {
    rt.floor.visible = rt.sceneParams.groundVisible;
  });
  scenePane.addBinding(rt.sceneParams, "groundColor", { label: "Ground Color" }).on("change", () => {
    rt.floorMaterial.color.set(rt.sceneParams.groundColor);
  });
  scenePane.addBinding(rt.sceneParams, "backgroundColor", { label: "Background" }).on("change", () => {
    rt.scene.background = new THREE.Color(rt.sceneParams.backgroundColor);
  });
}
