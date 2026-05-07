import { Pane } from "tweakpane";
import type { PanelRuntime } from "../panel-runtime";

export function installMotionPane(rt: PanelRuntime, host: HTMLDivElement): void {
  const motionPane = new Pane({ title: "Motion", expanded: true, container: host });
  rt.motionPane = motionPane;

  const loops = motionPane.addFolder({ title: "Loops", expanded: true });
  loops.addBinding(rt.motionParams, "hoverEnabled", { label: "Hover" }).on("change", (ev) => {
    rt.motionActions.setHoverEnabled(ev.value);
  });
  loops.addBinding(rt.motionParams, "breatheEnabled", { label: "Breathe" }).on("change", (ev) => {
    rt.motionActions.setBreatheEnabled(ev.value);
  });
  loops.addBinding(rt.motionParams, "leanEnabled", { label: "Lean by velocity" }).on("change", (ev) => {
    rt.motionActions.setLeanEnabled(ev.value);
  });
  loops.addBinding(rt.motionParams, "autoPopEnabled", { label: "Auto pop" }).on("change", (ev) => {
    rt.motionActions.setAutoPopEnabled(ev.value);
  });

  const shots = motionPane.addFolder({ title: "One-shots", expanded: true });
  shots.addButton({ title: "Pop" }).on("click", () => rt.motionActions.triggerPop());
  shots.addButton({ title: "Squash" }).on("click", () => rt.motionActions.triggerSquash());
  shots.addButton({ title: "Recoil" }).on("click", () => rt.motionActions.triggerRecoil());
}
