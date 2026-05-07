import type { Object3D } from "three";
import type { PanelRuntime } from "../panel-runtime";

export function updateEmitterMovement(dt: number, rt: PanelRuntime): void {
  if (!rt.globalDebugParams.movementEnabled) return;
  rt.movementElapsed += dt;
  const soloed = rt.layers.filter((layer) => layer.solo && !layer.muted);
  const activeLayers = soloed.length > 0 ? soloed : rt.layers.filter((layer) => !layer.muted);
  if (rt.globalDebugParams.movementMode === "stationary") {
    for (const layer of activeLayers) {
      const system = rt.activeSystemsByLayerId.get(layer.id);
      if (!system) continue;
      const object = system as unknown as Object3D;
      object.position.set(layer.emitterOffset.x, layer.emitterOffset.y, layer.emitterOffset.z);
    }
    return;
  }
  const radius = 1.8;
  const angularSpeedRadPerSec = 0.8 * Math.max(0, rt.globalDebugParams.movementSpeed);
  const angle = rt.movementElapsed * angularSpeedRadPerSec;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  for (const layer of activeLayers) {
    const system = rt.activeSystemsByLayerId.get(layer.id);
    if (!system) continue;
    const object = system as unknown as Object3D;
    object.position.set(x + layer.emitterOffset.x, layer.emitterOffset.y, z + layer.emitterOffset.z);
  }
}
