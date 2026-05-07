import { Pane } from "tweakpane";
import { clonePreset } from "../lib/preset-utils";
import type { PanelRuntime } from "../panel-runtime";
import {
  createLayer,
  getActiveLayerSystems,
  sanitizeLayerEventLinks,
  type EditorLayer,
} from "../state/layers";

function layerTitleWithState(layer: EditorLayer): string {
  const suffix = `${layer.muted ? " (M)" : ""}${layer.solo ? " (S)" : ""}`;
  return `${layer.name}${suffix}`;
}

export function installLayersPane(rt: PanelRuntime, host: HTMLDivElement): void {
  const layersRootPane = new Pane({ title: "Layers", expanded: true, container: host });
  rt.layersRootPane = layersRootPane;
  const layersTabs = (layersRootPane as unknown as {
    addTab: (options: { pages: Array<{ title: string }> }) => { pages: unknown[] };
  }).addTab({
    pages: [{ title: "Layers" }, { title: "Export" }, { title: "Import" }],
  });
  rt.layersPane = layersTabs.pages[0] as Pane;
  rt.jsonPane = layersTabs.pages[1] as Pane;
  rt.importPane = layersTabs.pages[2] as Pane;

  function clearLayersPaneDynamicControls(): void {
    for (const cleanup of rt.layersPaneDynamicCleanups.splice(0, rt.layersPaneDynamicCleanups.length)) cleanup();
    for (const item of rt.layersPaneDynamicDisposables.splice(0, rt.layersPaneDynamicDisposables.length)) item.dispose?.();
  }

  function rebuildLayersPaneFolders(): void {
    const addNewEffectLayer = (): void => {
      const next = createLayer(clonePreset(rt.defaultPresetTemplate), rt.layerIdCounter);
      rt.layers.push(next);
      sanitizeLayerEventLinks(rt.layers);
      rt.setSelectedLayerById(next.id);
      rt.syncParamsFromPreset();
      refreshLayersSummary();
      rebuildLayersPaneFolders();
      rt.refreshPaneSafely();
      rt.jsonPane.refresh();
      rt.respawn();
    };

    sanitizeLayerEventLinks(rt.layers);
    clearLayersPaneDynamicControls();
    for (const layer of rt.layers) {
      const folder = rt.layersPane.addFolder({
        title: layerTitleWithState(layer),
        expanded: layer.id === rt.selectedLayerId,
      }) as unknown as {
        addFolder: (options: { title: string; expanded?: boolean }) => {
          addBinding: (
            object: object,
            key: string,
            options?: Record<string, unknown>
          ) => { on: (event: string, handler: () => void) => void; dispose?: () => void };
          dispose?: () => void;
        };
        addBinding: (
          object: object,
          key: string,
          options?: Record<string, unknown>
        ) => { on: (event: string, handler: () => void) => void; dispose?: () => void };
        addButton: (options: { title: string }) => { on: (event: string, handler: () => void) => void; dispose?: () => void };
        element?: HTMLElement;
        dispose?: () => void;
      };
      rt.layersPaneDynamicDisposables.push(folder);

      const titleElement = folder.element?.querySelector<HTMLElement>(".tp-fldv_t");
      const onTitleClick = (): void => {
        if (layer.id !== rt.selectedLayerId) rt.selectLayerAndRefresh(layer.id);
      };
      titleElement?.addEventListener("click", onTitleClick);
      rt.layersPaneDynamicCleanups.push(() => titleElement?.removeEventListener("click", onTitleClick));

      const nameBinding = folder.addBinding(layer, "name", { label: "Name", view: "text" });
      nameBinding.on("change", () => {
        layer.name = layer.name.trim() || "Layer";
        rt.refreshLayersSummary();
        rebuildLayersPaneFolders();
      });
      rt.layersPaneDynamicDisposables.push(nameBinding);

      const mutedBinding = folder.addBinding(layer, "muted", { label: "Muted" });
      mutedBinding.on("change", () => {
        rt.refreshLayersSummary();
        rebuildLayersPaneFolders();
        rt.respawn();
      });
      rt.layersPaneDynamicDisposables.push(mutedBinding);

      const soloBinding = folder.addBinding(layer, "solo", { label: "Solo" });
      soloBinding.on("change", () => {
        rt.refreshLayersSummary();
        rebuildLayersPaneFolders();
        rt.respawn();
      });
      rt.layersPaneDynamicDisposables.push(soloBinding);

      const offsetBinding = folder.addBinding(layer, "startOffsetSec", {
        label: "Offset (s)",
        min: 0,
        max: 30,
        step: 0.01,
      });
      offsetBinding.on("change", () => {
        layer.startOffsetSec = Math.max(0, layer.startOffsetSec);
        rt.respawn();
      });
      rt.layersPaneDynamicDisposables.push(offsetBinding);

      const eventsFolder = folder.addFolder({ title: "Events", expanded: false });
      rt.layersPaneDynamicDisposables.push(eventsFolder);
      const linkOptions = {
        None: "none",
        ...Object.fromEntries(
          rt.layers.map((candidate) => [layerTitleWithState(candidate), candidate.id])
        ),
      };
      const onBirthBinding = eventsFolder.addBinding(layer.eventLinks, "onBirth", { label: "On Birth", options: linkOptions });
      onBirthBinding.on("change", () => rt.respawn());
      rt.layersPaneDynamicDisposables.push(onBirthBinding);
      const onDeathBinding = eventsFolder.addBinding(layer.eventLinks, "onDeath", { label: "On Death", options: linkOptions });
      onDeathBinding.on("change", () => rt.respawn());
      rt.layersPaneDynamicDisposables.push(onDeathBinding);
      const onCollisionBinding = eventsFolder.addBinding(layer.eventLinks, "onCollision", { label: "On Collision", options: linkOptions });
      onCollisionBinding.on("change", () => rt.respawn());
      rt.layersPaneDynamicDisposables.push(onCollisionBinding);

      const actionGrid = document.createElement("div");
      actionGrid.className = "layer-actions-grid";
      const cloneButton = document.createElement("button");
      cloneButton.type = "button";
      cloneButton.textContent = "Clone";
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      actionGrid.append(cloneButton, deleteButton);
      const folderContentElement = folder.element?.querySelector<HTMLElement>(".tp-fldv_c");
      (folderContentElement ?? folder.element)?.appendChild(actionGrid);
      const onClone = (): void => {
        const next = createLayer(clonePreset(layer.preset), rt.layerIdCounter);
        next.name = `${layer.name} Copy`;
        rt.layers.push(next);
        sanitizeLayerEventLinks(rt.layers);
        rt.setSelectedLayerById(next.id);
        rt.syncParamsFromPreset();
        refreshLayersSummary();
        rebuildLayersPaneFolders();
        rt.refreshPaneSafely();
        rt.jsonPane.refresh();
        rt.respawn();
      };
      const onDelete = (): void => {
        if (rt.layers.length <= 1) {
          window.alert("At least one layer is required.");
          return;
        }
        if (!window.confirm(`Delete layer \"${layer.name}\"?`)) return;
        const idx = rt.layers.findIndex((entry) => entry.id === layer.id);
        if (idx >= 0) rt.layers.splice(idx, 1);
        sanitizeLayerEventLinks(rt.layers);
        const fallback = rt.layers[Math.max(0, idx - 1)] ?? rt.layers[0];
        rt.selectLayerAndRefresh(fallback.id);
        rt.respawn();
      };
      cloneButton.addEventListener("click", onClone);
      deleteButton.addEventListener("click", onDelete);
      rt.layersPaneDynamicCleanups.push(() => {
        cloneButton.removeEventListener("click", onClone);
        deleteButton.removeEventListener("click", onDelete);
        actionGrid.remove();
      });

      const newEffectButton = rt.layersPane.addButton({ title: "New effect" });
      newEffectButton.on("click", addNewEffectLayer);
      rt.layersPaneDynamicDisposables.push(newEffectButton);
    }
    rt.layersPane.refresh();
  }

  function refreshLayersSummary(): void {
    const soloCount = rt.layers.filter((layer) => layer.solo && !layer.muted).length;
    rt.layersPaneParams.layerSummary = `${rt.layers.length} layer(s), ${soloCount} soloed`;
    rt.refreshExportJson();
  }

  function selectLayerAndRefresh(layerId: string): void {
    rt.setSelectedLayerById(layerId);
    rt.syncParamsFromPreset();
    rt.refreshDiagnostics();
    rt.refreshPaneSafely();
    rt.jsonPane.refresh();
    rt.diagnosticsPane.refresh();
    refreshLayersSummary();
    rebuildLayersPaneFolders();
  }

  rt.rebuildLayersPaneFolders = rebuildLayersPaneFolders;
  rt.refreshLayersSummary = refreshLayersSummary;
  rt.selectLayerAndRefresh = selectLayerAndRefresh;

  rt.layersPane.addBinding(rt.layersPaneParams, "layerSummary", { label: "Session", readonly: true });
  rt.layersPane.addButton({ title: "Restart Active Layers" }).on("click", () => {
    for (const system of getActiveLayerSystems(rt.layers, rt.activeSystemsByLayerId)) system.restart();
  });
  refreshLayersSummary();
  rebuildLayersPaneFolders();
}
