import * as THREE from "three";
import type { Curve, Gradient } from "../../src";
import {
  defaultGradientStops,
  normalizeGradientStops,
  type GradientStopsValue,
} from "../../demo/tweakpane-gradient-plugin/index.js";

export function gradientToStops(gradient: Gradient | undefined, fallbackOpacity: Curve | undefined): GradientStopsValue {
  const colors = gradient?.map(([t, c]) => [t, new THREE.Color(c).getStyle()] as [number, string]);
  const opacities = fallbackOpacity?.map(([t, v]) => [t, v] as [number, number]);
  return normalizeGradientStops({
    colors: colors && colors.length >= 2 ? colors : defaultGradientStops().colors,
    opacities: opacities && opacities.length >= 2 ? opacities : defaultGradientStops().opacities,
  });
}
