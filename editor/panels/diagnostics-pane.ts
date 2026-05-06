import { Pane } from "tweakpane";
import * as EssentialsPlugin from "@tweakpane/plugin-essentials";
import type { PanelRuntime } from "../panel-runtime";

export function installDiagnosticsPane(rt: PanelRuntime, host: HTMLDivElement): void {
  const diagnosticsPane = new Pane({ title: "Diagnostics", expanded: true, container: host });
  rt.diagnosticsPane = diagnosticsPane;
  diagnosticsPane.registerPlugin(EssentialsPlugin);
  const fpsGraph = (diagnosticsPane as unknown as {
    addBlade: (params: Record<string, unknown>) => { begin: () => void; end: () => void };
  }).addBlade({
    view: "fpsgraph",
    label: "FPS",
    rows: 2,
  });
  rt.fpsGraph = fpsGraph;
  const runtimeFolder = diagnosticsPane.addFolder({ title: "Runtime Stats", expanded: false });
  runtimeFolder.addBinding(rt.runtimeStats, "systems", { readonly: true, label: "Systems" });
  runtimeFolder.addBinding(rt.runtimeStats, "cpuSystems", { readonly: true, label: "CPU Systems" });
  runtimeFolder.addBinding(rt.runtimeStats, "gpuSystems", { readonly: true, label: "GPU Systems" });
  runtimeFolder.addBinding(rt.runtimeStats, "aliveTotal", { readonly: true, label: "Alive Total" });
  runtimeFolder.addBinding(rt.runtimeStats, "maxTotal", { readonly: true, label: "Max Total" });
  runtimeFolder.addBinding(rt.runtimeStats, "busiest", { readonly: true, label: "Busiest" });
  runtimeFolder.addBinding(rt.runtimeStats, "busiestAlive", { readonly: true, label: "Busiest Alive" });
  const validationFolder = diagnosticsPane.addFolder({ title: "Validation", expanded: false });
  validationFolder.addBinding(rt.params, "diagnostics", { label: "Diagnostics", multiline: true, rows: 4, readonly: true });
}
