export type { GradientStopsValue } from "./types.js";
export type { GradientStopsInputParams } from "./plugin.js";
export {
  defaultGradientStops,
  cloneGradientStops,
  isGradientStopsValue,
  normalizeGradientStops,
  gradientsEqual,
} from "./types.js";
export { rgbaAt, sampleStops, sampleColorRgb } from "./sample.js";

import {
  gradientStopsInputPlugin,
  gradientStopsPluginCss,
} from "./plugin.js";

export { gradientStopsInputPlugin, gradientStopsPluginCss };

export const tweakpaneGradientPluginBundle = {
  id: "gradient-stops",
  css: gradientStopsPluginCss,
  plugins: [gradientStopsInputPlugin],
} as const;
