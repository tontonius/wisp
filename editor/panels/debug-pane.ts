import * as THREE from "three";
import { Pane } from "tweakpane";
import * as EssentialsPlugin from "@tweakpane/plugin-essentials";
import { getActiveLayerSystems } from "../state/layers";
import type { PanelRuntime } from "../panel-runtime";

export function installDebugPane(rt: PanelRuntime, host: HTMLDivElement): void {
  const debugPane = new Pane({ title: "Debug", expanded: true, container: host });
  rt.debugPane = debugPane;

  debugPane.addBinding(rt.globalDebugParams, "enabled", { label: "Debug Gizmos" }).on("change", () => {
    if (!rt.wisp.particles) return;
    rt.wisp.particles.setDebug(rt.globalDebugParams.enabled);
  });
  if (rt.wisp.particles) {
    rt.wisp.particles.setDebug(rt.globalDebugParams.enabled);
  }
  const cameraFolder = debugPane.addFolder({ title: "Camera", expanded: true });
  cameraFolder.addBinding(rt.globalDebugParams, "autoOrbit", { label: "Auto orbit" });
  cameraFolder.addBinding(rt.globalDebugParams, "orbitSpeedDegPerSec", {
    label: "Speed (deg/s)",
    min: -180,
    max: 180,
    step: 1,
  });
  const movementFolder = debugPane.addFolder({ title: "Movement", expanded: false });
  movementFolder.addBinding(rt.globalDebugParams, "movementEnabled", { label: "Enabled" });
  movementFolder.addBinding(rt.globalDebugParams, "movementMode", {
    label: "Mode",
    options: {
      circleLinear: "circleLinear",
      stationary: "stationary",
    },
  });
  movementFolder.addBinding(rt.globalDebugParams, "movementSpeed", {
    label: "Speed",
    min: 0,
    max: 10,
    step: 0.01,
  });

  const debugPlaybackControls = document.createElement("div");
  debugPlaybackControls.className = "debug-playback-grid";
  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.textContent = "Play";
  const pauseButton = document.createElement("button");
  pauseButton.type = "button";
  pauseButton.textContent = "Pause";
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "Reset";
  debugPlaybackControls.append(playButton, pauseButton, resetButton);
  ((debugPane as unknown as { element?: HTMLElement }).element ?? host).appendChild(debugPlaybackControls);

  debugPane.addBinding(rt.globalDebugParams, "playbackSpeed", {
    label: "Playback Speed",
    min: 0,
    max: 2,
    step: 0.01,
  });

  rt.updateDebugPlaybackButtons = (): void => {
    playButton.classList.toggle("is-active", rt.debugPlaybackMode === "play");
    pauseButton.classList.toggle("is-active", rt.debugPlaybackMode === "pause");
  };

  rt.seekActiveSystemTo = (targetTime: number): void => {
    const selectedSystem = rt.getSelectedActiveSystem();
    if (!selectedSystem) return;
    const duration = Math.max(0.01, rt.ensureSelectedLayer().preset.duration ?? 1);
    const clamped = THREE.MathUtils.clamp(targetTime, 0, duration);
    selectedSystem.restart();
    if (clamped <= 0) {
      selectedSystem.pause();
      rt.globalDebugParams.playbackTime = 0;
      return;
    }
    let remaining = clamped;
    const step = 1 / 120;
    while (remaining > 0) {
      const dtSeek = Math.min(step, remaining);
      selectedSystem.update(dtSeek, rt.camera);
      remaining -= dtSeek;
    }
    selectedSystem.pause();
    rt.globalDebugParams.playbackTime = clamped;
  };

  rt.setDebugPlaybackMode = (mode: "play" | "pause"): void => {
    rt.debugPlaybackMode = mode;
    for (const system of getActiveLayerSystems(rt.layers, rt.activeSystemsByLayerId)) {
      if (mode === "play") system.play();
      if (mode === "pause") system.pause();
    }
    rt.updateDebugPlaybackButtons();
  };

  playButton.addEventListener("click", () => rt.setDebugPlaybackMode("play"));
  pauseButton.addEventListener("click", () => rt.setDebugPlaybackMode("pause"));
  resetButton.addEventListener("click", () => {
    const activeSystems = getActiveLayerSystems(rt.layers, rt.activeSystemsByLayerId);
    if (activeSystems.length === 0) return;
    for (const system of activeSystems) {
      system.restart();
      if (rt.debugPlaybackMode !== "play") system.pause();
    }
    rt.globalDebugParams.playbackTime = 0;
  });
  rt.updateDebugPlaybackButtons();

  rt.rebuildDebugPlaybackBinding = (): void => {
    if (rt.debugPlaybackBinding?.dispose) rt.debugPlaybackBinding.dispose();
    rt.debugPlaybackBinding = debugPane.addBinding(rt.globalDebugParams, "playbackTime", {
      label: "Playback (s)",
      min: 0,
      max: rt.debugPlaybackDuration,
    }) as unknown as { dispose?: () => void; label?: string };
    rt.debugPlaybackBinding.on?.("change", (ev) => {
      if (rt.debugPlaybackMode !== "pause") return;
      rt.seekActiveSystemTo(ev.value);
    });
  };
  rt.rebuildDebugPlaybackBinding();
}
