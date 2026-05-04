import type { GradientStopsValue } from "./types.js";

/** Built-in swatches for the gradient editor (demo / quick try-out). */
export type GradientPresetItem = {
  id: string;
  /** Short label for tooltips / a11y */
  title: string;
  value: GradientStopsValue;
};

/**
 * Preset swatches: a starter library row, then gradients copied from
 * `demo/presets.ts` `overLifetime.color` + `overLifetime.opacity` (when both exist).
 */
export const GRADIENT_PRESETS: readonly GradientPresetItem[] = [
  {
    id: "white-red-maroon",
    title: "White → red → maroon",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.5, "#ff2020"],
        [1, "#3d0a12"],
      ],
      opacities: [
        [0, 1],
        [1, 1],
      ],
    },
  },
  {
    id: "lime-purple-fade",
    title: "Lime → purple (fade)",
    value: {
      colors: [
        [0, "#c8ff7a"],
        [1, "#9b5cff"],
      ],
      opacities: [
        [0, 1],
        [1, 0.35],
      ],
    },
  },
  {
    id: "yellow-lavender-fade",
    title: "Pale yellow → lavender (fade)",
    value: {
      colors: [
        [0, "#fff3b0"],
        [1, "#e8d4f5"],
      ],
      opacities: [
        [0, 1],
        [1, 0.45],
      ],
    },
  },
  {
    id: "rainbow-fade-out",
    title: "Rainbow → transparent",
    value: {
      colors: [
        [0, "#ff1744"],
        [0.22, "#ff9800"],
        [0.44, "#ffeb3b"],
        [0.56, "#76ff03"],
        [0.78, "#2979ff"],
        [1, "#651fff"],
      ],
      opacities: [
        [0, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "white-fade-out",
    title: "White → transparent",
    value: {
      colors: [
        [0, "#ffffff"],
        [1, "#ffffff"],
      ],
      opacities: [
        [0, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "candy",
    title: "Candy spectrum",
    value: {
      colors: [
        [0, "#ff5ea8"],
        [0.18, "#ffe135"],
        [0.38, "#5ddf6e"],
        [0.55, "#ff9d3c"],
        [0.72, "#4dabf7"],
        [1, "#ff5ea8"],
      ],
      opacities: [
        [0, 1],
        [1, 1],
      ],
    },
  },
  {
    id: "magenta-white-magenta",
    title: "Magenta ↔ white",
    value: {
      colors: [
        [0, "#e040fb"],
        [0.5, "#ffffff"],
        [1, "#e040fb"],
      ],
      opacities: [
        [0, 1],
        [1, 1],
      ],
    },
  },
  {
    id: "orange-glow",
    title: "Transparent ↔ orange",
    value: {
      colors: [
        [0, "#ff9100"],
        [1, "#ff9100"],
      ],
      opacities: [
        [0, 0],
        [0.5, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "spectrum",
    title: "Full spectrum",
    value: {
      colors: [
        [0, "#ff0000"],
        [0.17, "#ff8800"],
        [0.33, "#ffee00"],
        [0.5, "#00e676"],
        [0.67, "#00e5ff"],
        [0.83, "#2962ff"],
        [1, "#aa00ff"],
      ],
      opacities: [
        [0, 1],
        [1, 1],
      ],
    },
  },
  {
    id: "pastel-blue-pink",
    title: "Pastel blue → pink",
    value: {
      colors: [
        [0, "#b3e5fc"],
        [1, "#f8bbd0"],
      ],
      opacities: [
        [0, 1],
        [1, 1],
      ],
    },
  },
  {
    id: "white-soft-fade",
    title: "White soft fade",
    value: {
      colors: [
        [0, "#ffffff"],
        [1, "#ffffff"],
      ],
      opacities: [
        [0, 1],
        [0.45, 0.55],
        [1, 0],
      ],
    },
  },
  {
    id: "ember",
    title: "Orange → dark ember",
    value: {
      colors: [
        [0, "#ff6d00"],
        [0.55, "#5d1f0c"],
        [1, "#120705"],
      ],
      opacities: [
        [0, 1],
        [1, 1],
      ],
    },
  },

  // --- Demo presets (`demo/presets.ts` over-lifetime color + opacity) ---

  {
    id: "demo-muzzle-flash",
    title: "Demo: muzzle flash",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.45, "#ffaa22"],
        [1, "#ff3300"],
      ],
      opacities: [
        [0, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-bullet-sparks",
    title: "Demo: bullet impact sparks",
    value: {
      colors: [
        [0, "#fff9df"],
        [0.35, "#ffb255"],
        [0.75, "#ff5a2e"],
        [1, "#2b0f08"],
      ],
      opacities: [
        [0, 0],
        [0.04, 1],
        [0.72, 0.9],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-smoke-puff",
    title: "Demo: smoke puff",
    value: {
      colors: [
        [0, "#aaaaaa"],
        [1, "#252832"],
      ],
      opacities: [
        [0, 0],
        [0.14, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-pickup-sparkle",
    title: "Demo: pickup sparkle",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.45, "#7df9ff"],
        [1, "#ffec8a"],
      ],
      opacities: [
        [0, 0],
        [0.12, 1],
        [0.78, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-torch-fire",
    title: "Demo: torch fire",
    value: {
      colors: [
        [0, "#fff8c8"],
        [0.35, "#ff9f1c"],
        [0.72, "#e53e1b"],
        [1, "#2b1209"],
      ],
      opacities: [
        [0, 0],
        [0.08, 1],
        [0.7, 0.65],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-stretched-billboard",
    title: "Demo: stretched billboard trail",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.42, "#82d7ff"],
        [1, "#4d95ff"],
      ],
      opacities: [
        [0, 0],
        [0.08, 1],
        [0.75, 0.85],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-magic-aura",
    title: "Demo: magic aura (CPU)",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.5, "#66d9ff"],
        [1, "#8e5cff"],
      ],
      opacities: [
        [0, 0],
        [0.2, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-explosion",
    title: "Demo: explosion",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.22, "#ffcc33"],
        [0.6, "#ff4422"],
        [1, "#333333"],
      ],
      opacities: [
        [0, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-tornado",
    title: "Demo: tornado debris",
    value: {
      colors: [
        [0, "#e4ebf3"],
        [0.35, "#9aa4b1"],
        [1, "#474f58"],
      ],
      opacities: [
        [0, 0],
        [0.08, 1],
        [0.84, 0.78],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-orbiting-dust",
    title: "Demo: orbiting emitter dust",
    value: {
      colors: [
        [0, "#2a2d33"],
        [0.25, "#a99c8c"],
        [1, "#ffffff"],
      ],
      opacities: [
        [0, 0],
        [0.08, 1],
        [0.62, 0.82],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-floor-bounce",
    title: "Demo: floor bounce sparks",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.35, "#9fe0ff"],
        [1, "#5aa8ff"],
      ],
      opacities: [
        [0, 0],
        [0.06, 1],
        [0.85, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-rain-gpu",
    title: "Demo: rain (GPU)",
    value: {
      colors: [
        [0, "#ffffff"],
        [1, "#74bfff"],
      ],
      opacities: [
        [0, 0],
        [0.04, 1],
        [0.9, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-snow-gpu",
    title: "Demo: snow (GPU)",
    value: {
      colors: [
        [0, "#ffffff"],
        [1, "#edf3f7"],
      ],
      opacities: [
        [0, 0],
        [0.08, 1],
        [0.86, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-magic-aura-gpu",
    title: "Demo: magic aura (GPU)",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.45, "#70e7ff"],
        [1, "#b388ff"],
      ],
      opacities: [
        [0, 0],
        [0.16, 1],
        [0.82, 0.75],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-gpu-magic-storm",
    title: "Demo: GPU magic storm",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.5, "#72e5ff"],
        [1, "#9b6dff"],
      ],
      opacities: [
        [0, 0],
        [0.18, 1],
        [0.78, 0.8],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-candy-vortex",
    title: "Demo: candy vortex",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.45, "#70e7ff"],
        [0.841640625, "#ffade8"],
      ],
      opacities: [
        [0, 0],
        [0.12, 1],
        [0.833046875, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-blue-flame-dispersal",
    title: "Demo: blue flame (dispersal)",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.45, "#70e7ff"],
        [1, "#ff7ad9"],
      ],
      opacities: [
        [0, 0],
        [0.12, 1],
        [0.92, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-shockwave-center",
    title: "Demo: shockwave (center explosion)",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.16846354166666666, "#ffec70"],
        [0.8229427083333334, "#a46f4c"],
      ],
      opacities: [
        [0, 0],
        [0.12, 1],
        [0.95, 1],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-shockwave-ring",
    title: "Demo: shockwave ring",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.11036458333333334, "#fff59d"],
        [0.2570572916666667, "#f4b53f"],
        [0.4859895833333333, "#b47a2e"],
        [0.6268489583333333, "#994d34"],
        [0.828984375, "#303030"],
      ],
      opacities: [
        [0, 1],
        [0.74515625, 0.6211032653942217],
        [1, 0],
      ],
    },
  },
  {
    id: "demo-shrapnel",
    title: "Demo: shockwave shrapnel",
    value: {
      colors: [
        [0, "#ffffff"],
        [0.45, "#fff0c2"],
        [0.65, "#f2aa63"],
        [1, "#6b3d24"],
      ],
      opacities: [
        [0, 1],
        [0.8, 0.85],
        [1, 0],
      ],
    },
  },
];
