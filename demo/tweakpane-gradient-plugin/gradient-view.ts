import type { Value, ViewProps } from "@tweakpane/core";
import type { View } from "@tweakpane/core";
import { GRADIENT_PRESETS } from "./gradient-presets.js";
import { paintGradientStrip, rgbaAt } from "./sample.js";
import type { GradientStopsValue } from "./types.js";
import { cloneGradientStops, normalizeGradientStops } from "./types.js";

const MIN_STOPS = 2;

type Selection = { kind: "color"; index: number } | { kind: "opacity"; index: number };

function sortStopsPermutation<T extends [number, unknown]>(stops: T[]): number[] {
  const decorated = stops.map((row, oldIndex) => ({ row, oldIndex }));
  decorated.sort((a, b) => (a.row[0] !== b.row[0] ? a.row[0] - b.row[0] : a.oldIndex - b.oldIndex));
  const oldToNew = Array(stops.length);
  decorated.forEach((d, newIndex) => {
    oldToNew[d.oldIndex] = newIndex;
  });
  stops.length = 0;
  for (const d of decorated) stops.push(d.row as T);
  return oldToNew;
}

export class GradientStopsView implements View {
  public readonly element: HTMLElement;
  private readonly value_: Value<GradientStopsValue>;
  private readonly viewProps_: ViewProps;

  private readonly opRow_: HTMLElement;
  private readonly canvas_: HTMLCanvasElement;
  private readonly colRow_: HTMLElement;
  private readonly colorInput_: HTMLInputElement;
  private readonly opacityInput_: HTMLInputElement;
  private readonly locInput_: HTMLInputElement;
  private readonly eyeBtn_: HTMLButtonElement;
  private readonly opacityLab_: HTMLLabelElement;
  private readonly colorLab_: HTMLLabelElement;
  private readonly swatch_: HTMLElement;
  private readonly presetGrid_: HTMLElement;
  private readonly presetPaintPairs_: Array<{ canvas: HTMLCanvasElement; value: GradientStopsValue }> = [];

  private selection_: Selection | null = { kind: "color", index: 0 };
  private drag_: { kind: "color" | "opacity"; index: number } | null = null;

  private ro_: ResizeObserver | null = null;
  private presetRo_: ResizeObserver | null = null;

  private readonly onValueChange_ = () => this.syncFromModel();

  public constructor(doc: Document, config: { value: Value<GradientStopsValue>; viewProps: ViewProps }) {
    this.value_ = config.value;
    this.viewProps_ = config.viewProps;

    const root = doc.createElement("div");
    root.className = "tp-grdt";
    root.tabIndex = -1;
    this.element = root;
    config.viewProps.bindClassModifiers(root);

    const bar = doc.createElement("div");
    bar.className = "tp-grdt_bar";

    this.opRow_ = doc.createElement("div");
    this.opRow_.className = "tp-grdt_row tp-grdt_row-op";

    this.canvas_ = doc.createElement("canvas");
    this.canvas_.className = "tp-grdt_canvas";

    this.colRow_ = doc.createElement("div");
    this.colRow_.className = "tp-grdt_row tp-grdt_row-col";

    bar.appendChild(this.opRow_);
    bar.appendChild(this.canvas_);
    bar.appendChild(this.colRow_);
    root.appendChild(bar);

    const edit = doc.createElement("div");
    edit.className = "tp-grdt_edit";

    const colorLab = doc.createElement("label");
    colorLab.className = "tp-grdt_lbl tp-grdt_lbl-color";
    colorLab.textContent = "Color";
    const colorRow = doc.createElement("div");
    colorRow.className = "tp-grdt_field";
    this.swatch_ = doc.createElement("span");
    this.swatch_.className = "tp-grdt_swatch tp-colswv_sw";
    this.colorInput_ = doc.createElement("input");
    this.colorInput_.type = "color";
    this.colorInput_.className = "tp-grdt_color";
    this.eyeBtn_ = doc.createElement("button");
    this.eyeBtn_.type = "button";
    this.eyeBtn_.className = "tp-grdt_eye tp-btnv_b";
    this.eyeBtn_.title = "Pick from screen";
    this.eyeBtn_.textContent = "Pick";
    colorRow.appendChild(this.swatch_);
    colorRow.appendChild(this.colorInput_);
    colorRow.appendChild(this.eyeBtn_);
    colorLab.appendChild(colorRow);
    edit.appendChild(colorLab);
    this.colorLab_ = colorLab;

    this.opacityLab_ = doc.createElement("label");
    this.opacityLab_.className = "tp-grdt_lbl tp-grdt_lbl-opacity";
    this.opacityLab_.textContent = "Opacity";
    const opRow = doc.createElement("div");
    opRow.className = "tp-grdt_field";
    this.opacityInput_ = doc.createElement("input");
    this.opacityInput_.type = "number";
    this.opacityInput_.className = "tp-grdt_opacity tp-txtv_i";
    this.opacityInput_.min = "0";
    this.opacityInput_.max = "1";
    this.opacityInput_.step = "0.01";
    opRow.appendChild(this.opacityInput_);
    this.opacityLab_.appendChild(opRow);
    edit.appendChild(this.opacityLab_);

    const locLab = doc.createElement("label");
    locLab.className = "tp-grdt_lbl";
    locLab.textContent = "Location";
    const locRow = doc.createElement("div");
    locRow.className = "tp-grdt_field tp-grdt_field-loc";
    this.locInput_ = doc.createElement("input");
    this.locInput_.type = "text";
    this.locInput_.inputMode = "decimal";
    this.locInput_.className = "tp-grdt_loc tp-txtv_i";
    this.locInput_.min = "0";
    this.locInput_.max = "100";
    this.locInput_.step = "0.1";
    const pct = doc.createElement("span");
    pct.className = "tp-grdt_pct";
    pct.textContent = "%";
    locRow.appendChild(this.locInput_);
    locRow.appendChild(pct);
    locLab.appendChild(locRow);
    edit.appendChild(locLab);

    root.appendChild(edit);

    const presetsDetails = doc.createElement("details");
    presetsDetails.className = "tp-grdt_presets";
    presetsDetails.open = true;
    const presetsSum = doc.createElement("summary");
    presetsSum.className = "tp-grdt_presets-sum";
    const presetsLead = doc.createElement("span");
    presetsLead.className = "tp-grdt_presets-lead";
    const presetsArrow = doc.createElement("span");
    presetsArrow.className = "tp-grdt_presets-arrow";
    presetsArrow.setAttribute("aria-hidden", "true");
    const presetsTitle = doc.createElement("span");
    presetsTitle.className = "tp-grdt_presets-title";
    presetsTitle.textContent = "Presets";
    presetsLead.appendChild(presetsArrow);
    presetsLead.appendChild(presetsTitle);
    const presetsIcon = doc.createElement("span");
    presetsIcon.className = "tp-grdt_presets-ico";
    presetsIcon.setAttribute("aria-hidden", "true");
    presetsIcon.title = "Preset library";
    presetsSum.appendChild(presetsLead);
    presetsSum.appendChild(presetsIcon);

    this.presetGrid_ = doc.createElement("div");
    this.presetGrid_.className = "tp-grdt_preset-grid";

    for (const preset of GRADIENT_PRESETS) {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "tp-grdt_preset tp-btnv_b";
      btn.title = preset.title;
      btn.setAttribute("aria-label", `Load preset: ${preset.title}`);
      const cnv = doc.createElement("canvas");
      cnv.className = "tp-grdt_preset-canvas";
      btn.appendChild(cnv);
      this.presetPaintPairs_.push({ canvas: cnv, value: preset.value });
      btn.addEventListener("click", () => {
        const next = normalizeGradientStops(cloneGradientStops(preset.value));
        this.selection_ = { kind: "color", index: 0 };
        this.value_.setRawValue(next, { forceEmit: false, last: true });
      });
      this.viewProps_.bindDisabled(btn);
      this.presetGrid_.appendChild(btn);
    }

    presetsDetails.appendChild(presetsSum);
    presetsDetails.appendChild(this.presetGrid_);
    root.appendChild(presetsDetails);

    if (!("EyeDropper" in window)) this.eyeBtn_.style.display = "none";

    this.swatch_.addEventListener("click", () => this.colorInput_.click());

    this.colorInput_.addEventListener("input", () => {
      if (!this.selection_ || this.selection_.kind !== "color") return;
      const next = cloneGradientStops(this.value_.rawValue);
      next.colors[this.selection_.index][1] = this.colorInput_.value;
      this.value_.setRawValue(next, { forceEmit: false, last: true });
    });

    this.opacityInput_.addEventListener("change", () => {
      if (!this.selection_ || this.selection_.kind !== "opacity") return;
      const v = Number(this.opacityInput_.value.replace(",", "."));
      if (Number.isNaN(v)) return;
      const next = cloneGradientStops(this.value_.rawValue);
      next.opacities[this.selection_.index][1] = Math.min(1, Math.max(0, v));
      this.value_.setRawValue(next, { forceEmit: false, last: true });
    });

    this.locInput_.addEventListener("change", () => this.applyLocationFromInput());

    this.eyeBtn_.addEventListener("click", async () => {
      if (!this.selection_ || this.selection_.kind !== "color") return;
      const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      if (!ED) return;
      try {
        const res = await new ED().open();
        const next = cloneGradientStops(this.value_.rawValue);
        next.colors[this.selection_.index][1] = res.sRGBHex;
        this.value_.setRawValue(next, { forceEmit: false, last: true });
      } catch {
        /* cancelled */
      }
    });

    this.canvas_.addEventListener("dblclick", (ev) => this.onBarDblClick(ev, "color"));
    this.opRow_.addEventListener("dblclick", (ev) => this.onBarDblClick(ev, "opacity"));
    this.colRow_.addEventListener("dblclick", (ev) => this.onBarDblClick(ev, "color"));

    root.addEventListener("keydown", (ev) => this.onKeydown(ev));

    this.canvas_.addEventListener("pointerdown", (ev) => this.beginDragFromBar(ev));
    this.opRow_.addEventListener("pointerdown", (ev) => this.beginDragFromTrack(ev, "opacity"));
    this.colRow_.addEventListener("pointerdown", (ev) => this.beginDragFromTrack(ev, "color"));

    this.viewProps_.bindDisabled(this.colorInput_);
    this.viewProps_.bindDisabled(this.opacityInput_);
    this.viewProps_.bindDisabled(this.locInput_);
    this.viewProps_.bindDisabled(this.eyeBtn_);

    this.value_.emitter.on("change", this.onValueChange_);

    this.ro_ = new ResizeObserver(() => this.paintCanvas());
    this.ro_.observe(this.canvas_);

    const repaintPresets = () => {
      for (const { canvas, value } of this.presetPaintPairs_) {
        paintGradientStrip(canvas, value, 18, 60);
      }
    };
    this.presetRo_ = new ResizeObserver(() => repaintPresets());
    this.presetRo_.observe(this.presetGrid_);
    requestAnimationFrame(() => repaintPresets());

    this.syncFromModel();
  }

  private tFromClientX(target: HTMLElement, clientX: number): number {
    const r = target.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  }

  private onBarDblClick(ev: MouseEvent, kind: "color" | "opacity"): void {
    ev.preventDefault();
    const t = this.tFromClientX(this.canvas_, ev.clientX);
    const v = cloneGradientStops(this.value_.rawValue);
    if (kind === "color") {
      const rgba = rgbaAt(v, t);
      const hex =
        "#" +
        [rgba[0], rgba[1], rgba[2]]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
      v.colors.push([t, hex]);
      sortStopsPermutation(v.colors);
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < v.colors.length; i++) {
        const d = Math.abs(v.colors[i][0] - t);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      this.selection_ = { kind: "color", index: best };
    } else {
      const alpha = rgbaAt(v, t)[3];
      v.opacities.push([t, alpha]);
      sortStopsPermutation(v.opacities);
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < v.opacities.length; i++) {
        const d = Math.abs(v.opacities[i][0] - t);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      this.selection_ = { kind: "opacity", index: best };
    }
    this.value_.setRawValue(v, { forceEmit: false, last: true });
  }

  private onKeydown(ev: KeyboardEvent): void {
    if (ev.key !== "Backspace" && ev.key !== "Delete") return;
    if (!this.selection_) return;
    const v = cloneGradientStops(this.value_.rawValue);
    if (this.selection_.kind === "color") {
      if (v.colors.length <= MIN_STOPS) return;
      const idx = this.selection_.index;
      v.colors.splice(idx, 1);
      sortStopsPermutation(v.colors);
      this.selection_ = { kind: "color", index: Math.min(idx, v.colors.length - 1) };
    } else {
      if (v.opacities.length <= MIN_STOPS) return;
      const idx = this.selection_.index;
      v.opacities.splice(idx, 1);
      sortStopsPermutation(v.opacities);
      this.selection_ = { kind: "opacity", index: Math.min(idx, v.opacities.length - 1) };
    }
    ev.preventDefault();
    this.value_.setRawValue(v, { forceEmit: false, last: true });
  }

  private hitTestHandle(clientX: number, clientY: number): { kind: "color" | "opacity"; index: number } | null {
    const els = [
      ...this.opRow_.querySelectorAll<HTMLElement>(".tp-grdt_handle-op"),
      ...this.colRow_.querySelectorAll<HTMLElement>(".tp-grdt_handle-col"),
    ];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const pad = 4;
      if (clientX >= r.left - pad && clientX <= r.right + pad && clientY >= r.top - pad && clientY <= r.bottom + pad) {
        const k = el.dataset.kind as "color" | "opacity";
        const index = Number(el.dataset.index);
        if ((k === "color" || k === "opacity") && !Number.isNaN(index)) return { kind: k, index };
      }
    }
    return null;
  }

  private beginDragFromTrack(ev: PointerEvent, kind: "color" | "opacity"): void {
    const hit = this.hitTestHandle(ev.clientX, ev.clientY);
    if (hit) {
      this.selection_ = hit;
      this.drag_ = hit;
      this.syncChromeOnly();
      this.attachDragListeners();
      return;
    }
    const row = kind === "opacity" ? this.opRow_ : this.colRow_;
    const t = this.tFromClientX(row, ev.clientX);
    this.selection_ = { kind, index: kind === "color" ? this.nearestColorIndex(t) : this.nearestOpacityIndex(t) };
    this.syncChromeOnly();
  }

  private beginDragFromBar(ev: PointerEvent): void {
    const hit = this.hitTestHandle(ev.clientX, ev.clientY);
    if (!hit) return;
    this.selection_ = hit;
    this.drag_ = hit;
    this.syncChromeOnly();
    this.attachDragListeners();
  }

  private attachDragListeners(): void {
    const onMove = (e: PointerEvent) => {
      if (!this.drag_) return;
      const t = this.tFromClientX(this.canvas_, e.clientX);
      const next = cloneGradientStops(this.value_.rawValue);
      const arr = this.drag_.kind === "color" ? next.colors : next.opacities;
      arr[this.drag_.index][0] = t;
      this.value_.setRawValue(next, { forceEmit: false, last: false });
      this.renderHandles();
      this.paintCanvas();
      this.syncChromeOnly();
    };
    const onUp = () => {
      if (this.drag_) {
        const next = cloneGradientStops(this.value_.rawValue);
        const kind = this.drag_.kind;
        const oldIndex = this.drag_.index;
        const perm =
          kind === "color"
            ? sortStopsPermutation(next.colors)
            : sortStopsPermutation(next.opacities);
        this.selection_ = { kind, index: perm[oldIndex] ?? 0 };
        this.drag_ = null;
        this.value_.setRawValue(next, { forceEmit: false, last: true });
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  private nearestColorIndex(t: number): number {
    const colors = this.value_.rawValue.colors;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < colors.length; i++) {
      const d = Math.abs(colors[i][0] - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private nearestOpacityIndex(t: number): number {
    const stops = this.value_.rawValue.opacities;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = Math.abs(stops[i][0] - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private applyLocationFromInput(): void {
    if (!this.selection_) return;
    const pct = Number(this.locInput_.value.replace(",", "."));
    if (Number.isNaN(pct)) return;
    const t = Math.min(1, Math.max(0, pct / 100));
    const next = cloneGradientStops(this.value_.rawValue);
    const arr = this.selection_.kind === "color" ? next.colors : next.opacities;
    const oldIndex = this.selection_.index;
    arr[oldIndex][0] = t;
    const perm =
      this.selection_.kind === "color"
        ? sortStopsPermutation(next.colors)
        : sortStopsPermutation(next.opacities);
    this.selection_ = { kind: this.selection_.kind, index: perm[oldIndex] ?? 0 };
    this.value_.setRawValue(next, { forceEmit: false, last: true });
  }

  private syncChromeOnly(): void {
    const v = this.value_.rawValue;
    const sel = this.selection_;
    if (!sel) {
      this.colorInput_.disabled = true;
      this.opacityInput_.disabled = true;
      this.locInput_.disabled = true;
      return;
    }
    const isColor = sel.kind === "color";
    this.colorInput_.disabled = !isColor;
    this.eyeBtn_.disabled = !isColor;
    this.colorLab_.style.display = isColor ? "block" : "none";
    this.opacityLab_.style.display = isColor ? "none" : "block";
    this.opacityInput_.disabled = isColor;
    this.locInput_.disabled = false;

    if (isColor) {
      const c = v.colors[sel.index]?.[1] ?? "#ffffff";
      const full = c.startsWith("#") && (c.length === 7 || c.length === 4) ? (c.length === 4 ? expandShortHex(c) : c) : "#ffffff";
      this.colorInput_.value = full;
      this.swatch_.style.background = full;
    } else {
      this.opacityInput_.value = String(v.opacities[sel.index]?.[1] ?? 1);
    }
    const t = isColor ? v.colors[sel.index]?.[0] ?? 0 : v.opacities[sel.index]?.[0] ?? 0;
    this.locInput_.value = String(Math.round(t * 1000) / 10);
  }

  private syncFromModel(): void {
    this.clampSelection();
    this.renderHandles();
    this.paintCanvas();
    this.syncChromeOnly();
  }

  private clampSelection(): void {
    if (!this.selection_) return;
    const v = this.value_.rawValue;
    if (this.selection_.kind === "color") {
      this.selection_.index = Math.max(0, Math.min(this.selection_.index, v.colors.length - 1));
    } else {
      this.selection_.index = Math.max(0, Math.min(this.selection_.index, v.opacities.length - 1));
    }
  }

  private renderHandles(): void {
    const v = this.value_.rawValue;
    this.opRow_.replaceChildren();
    this.colRow_.replaceChildren();

    v.opacities.forEach((stop, index) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "tp-grdt_handle tp-grdt_handle-op";
      el.style.left = `${stop[0] * 100}%`;
      const gray = Math.round((1 - stop[1]) * 255);
      el.style.setProperty("--op-fill", `rgb(${gray},${gray},${gray})`);
      el.dataset.kind = "opacity";
      el.dataset.index = String(index);
      if (this.selection_?.kind === "opacity" && this.selection_.index === index) el.classList.add("tp-grdt_handle-sel");
      this.opRow_.appendChild(el);
    });

    v.colors.forEach((stop, index) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "tp-grdt_handle tp-grdt_handle-col";
      el.style.left = `${stop[0] * 100}%`;
      el.style.setProperty("--col-fill", stop[1]);
      el.dataset.kind = "color";
      el.dataset.index = String(index);
      if (this.selection_?.kind === "color" && this.selection_.index === index) el.classList.add("tp-grdt_handle-sel");
      this.colRow_.appendChild(el);
    });
  }

  private paintCanvas(): void {
    paintGradientStrip(this.canvas_, this.value_.rawValue, 28, 200);
  }

  public dispose(): void {
    this.value_.emitter.off("change", this.onValueChange_);
    this.ro_?.disconnect();
    this.ro_ = null;
    this.presetRo_?.disconnect();
    this.presetRo_ = null;
  }
}

function expandShortHex(c: string): string {
  if (c.length !== 4 || !c.startsWith("#")) return "#ffffff";
  const r = c[1] + c[1];
  const g = c[2] + c[2];
  const b = c[3] + c[3];
  return `#${r}${g}${b}`;
}
