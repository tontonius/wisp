import type { BaseInputParams, InputBindingPlugin } from "@tweakpane/core";
import { createPlugin } from "@tweakpane/core";
import { GradientStopsController } from "./gradient-controller.js";
import {
  cloneGradientStops,
  gradientsEqual,
  isGradientStopsValue,
  normalizeGradientStops,
  type GradientStopsValue,
} from "./types.js";

export type GradientStopsInputParams = BaseInputParams & {
  view: "gradient";
};

export const gradientStopsPluginCss = /* css */ `
.tp-grdt {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: calc(var(--cnt-vp, 6px) + var(--bld-vp, 6px));
  width: calc(100% - var(--cnt-vp, 6px) - var(--bld-vp, 6px));
}
.tp-grdt_bar {
  display: flex;
  flex-direction: column;
  gap: 0;
  user-select: none;
}
.tp-grdt_row {
  position: relative;
  height: 14px;
  margin: 0 6px;
}
.tp-grdt_row-op {
  margin-bottom: 1px;
}
.tp-grdt_row-col {
  margin-top: 1px;
}
.tp-grdt_canvas {
  display: block;
  width: 100%;
  height: 28px;
  border-radius: 2px;
  margin: 0 6px;
  box-sizing: border-box;
  cursor: crosshair;
}
.tp-grdt_handle {
  position: absolute;
  top: 0;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  padding: 0;
  border: none;
  cursor: grab;
  transform: translateX(0);
  background: transparent;
  box-sizing: border-box;
  z-index: 1;
}
.tp-grdt_handle:active {
  cursor: grabbing;
}
.tp-grdt_handle-op {
  clip-path: polygon(50% 100%, 100% 35%, 80% 0, 20% 0, 0 35%);
  background: var(--op-fill, #888);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.35);
}
.tp-grdt_handle-col {
  clip-path: polygon(50% 0, 100% 65%, 80% 100%, 20% 100%, 0 65%);
  background: var(--col-fill, #fff);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.45);
}
.tp-grdt_handle-sel {
  z-index: 3;
  transform: translateX(0) scale(1.08);
  box-shadow: 0 0 0 2px var(--in-fg, #4488ff), 0 0 8px 1px var(--in-fg, #4488ff);
  filter: drop-shadow(0 0 1px var(--in-fg, #4488ff));
}
.tp-grdt_edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.tp-grdt_lbl {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--in-fg);
  opacity: 0.85;
}
.tp-grdt_field {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
.tp-grdt_swatch {
  width: var(--cnt-usz);
  height: var(--cnt-usz);
  cursor: pointer;
  border-radius: var(--bld-br);
  box-shadow: inset 0 0 0 1px var(--in-fg);
}
.tp-grdt_color {
  width: 0;
  height: 0;
  opacity: 0;
  position: absolute;
  pointer-events: none;
}
.tp-grdt_eye {
  padding: 0 10px;
  width: auto;
}
.tp-grdt_loc {
  width: 5.5em;
  text-align: right;
  padding: 0 6px;
}
.tp-grdt_opacity {
  width: 5.5em;
  text-align: right;
  padding: 0 6px;
}
.tp-grdt_pct {
  opacity: 0.75;
  font-size:11px;
  color: var(--in-fg);
}
.tp-grdt_lbl-opacity {
  display:flex;
}
.tp-grdt_presets {
  margin-top: 4px;
  border-top: 1px solid var(--grv-l, rgba(127,127,127,0.2));
  padding-top: 6px;
}
.tp-grdt_presets-sum {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  list-style: none;
  font-family: var(--font-family, monospace);
  font-size: 11px;
  color: var(--in-fg);
  opacity: 0.92;
  padding: 2px 0 8px;
  user-select: none;
}
.tp-grdt_presets-sum::-webkit-details-marker {
  display: none;
}
.tp-grdt_presets-lead {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.tp-grdt_presets-arrow {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  opacity: 0.75;
  transition: transform 0.12s ease;
  flex-shrink: 0;
}
.tp-grdt_presets:not([open]) .tp-grdt_presets-arrow {
  transform: rotate(-90deg);
}
.tp-grdt_presets-ico {
  display: block;
  width: 14px;
  height: 10px;
  opacity: 0.5;
  flex-shrink: 0;
  background: linear-gradient(currentColor, currentColor) 0 0 / 10px 2px no-repeat,
    linear-gradient(currentColor, currentColor) 0 4px / 10px 2px no-repeat,
    linear-gradient(currentColor, currentColor) 0 8px / 10px 2px no-repeat;
}
.tp-grdt_preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  width: 100%;
  margin-bottom: 2px;
}
.tp-grdt_preset {
  display: block;
  width: 100%;
  padding: 0;
  margin: 0;
  border-radius: var(--bld-br, 4px);
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.35);
  min-height: 22px;
  background: var(--bs-bg, #2f2f2f);
}
.tp-grdt_preset:focus-visible {
  outline: 1px solid var(--in-fg, #4488ff);
  outline-offset: 1px;
}
.tp-grdt_preset:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.tp-grdt_preset-canvas {
  display: block;
  width: 100%;
  height: 18px;
  vertical-align: top;
}
`;

export const gradientStopsInputPlugin: InputBindingPlugin<GradientStopsValue, GradientStopsValue, GradientStopsInputParams> =
  createPlugin({
    id: "input-gradient-stops",
    type: "input",
    accept: (exValue, params) => {
      if (params.view !== "gradient") return null;
      if (!isGradientStopsValue(exValue)) return null;
      return {
        initialValue: normalizeGradientStops(exValue),
        params: params as GradientStopsInputParams,
      };
    },
    binding: {
      reader: () => (ex: unknown) => normalizeGradientStops(ex),
      writer: () => (target, inValue) => {
        target.write(cloneGradientStops(inValue));
      },
      equals: gradientsEqual,
    },
    controller(args) {
      return new GradientStopsController(args.document, {
        value: args.value,
        viewProps: args.viewProps,
      });
    },
  });
