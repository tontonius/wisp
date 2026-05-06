import type { Object3D } from "three";
import type { PanelRuntime } from "../panel-runtime";
import { getActiveLayerSystems } from "../state/layers";

export function updateEmitterMovement(dt: number, rt: PanelRuntime): void {
  if (!rt.globalDebugParams.movementEnabled) return;
  rt.movementElapsed += dt;
  const y = 0.02;
  const systems = getActiveLayerSystems(rt.layers, rt.activeSystemsByLayerId);
  if (rt.globalDebugParams.movementMode === "stationary") {
    for (const system of systems) {
      const object = system as unknown as Object3D;
      object.position.set(0, y, 0);
    }
    return;
  }
  const radius = 1.8;
  const angularSpeedRadPerSec = 0.8 * Math.max(0, rt.globalDebugParams.movementSpeed);
  const angle = rt.movementElapsed * angularSpeedRadPerSec;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  for (const system of systems) {
    const object = system as unknown as Object3D;
    object.position.set(x, y, z);
  }
}
