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
