import type { GradientStopsValue } from "./types.js";

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Piecewise-linear sample over sorted stops (by x). */
export function sampleStops(stops: Array<[number, number]>, x: number): number {
  if (stops.length === 0) return 0;
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    if (x <= x1) {
      const span = x1 - x0;
      if (span <= 1e-8) return y1;
      const u = (x - x0) / span;
      return lerp(y0, y1, u);
    }
  }
  return stops[stops.length - 1][1];
}

export function sampleColorRgb(stops: Array<[number, string]>, x: number): { r: number; g: number; b: number } {
  if (stops.length === 0) return { r: 255, g: 255, b: 255 };
  if (x <= stops[0][0]) return parseHexColor(stops[0][1]);
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, c0] = stops[i];
    const [x1, c1] = stops[i + 1];
    if (x <= x1) {
      const span = x1 - x0;
      const a = parseHexColor(c0);
      const b = parseHexColor(c1);
      if (span <= 1e-8) return b;
      const u = (x - x0) / span;
      return {
        r: Math.round(lerp(a.r, b.r, u)),
        g: Math.round(lerp(a.g, b.g, u)),
        b: Math.round(lerp(a.b, b.b, u)),
      };
    }
  }
  return parseHexColor(stops[stops.length - 1][1]);
}

export function rgbaAt(value: GradientStopsValue, t: number): [number, number, number, number] {
  const colors = [...value.colors].sort((a, b) => a[0] - b[0]);
  const opacities = [...value.opacities].sort((a, b) => a[0] - b[0]);
  const { r, g, b } = sampleColorRgb(colors, t);
  const alpha = sampleStops(opacities, t);
  return [r, g, b, alpha];
}

function checkerStyle(size: number): CanvasPattern | null {
  const c = document.createElement("canvas");
  c.width = size * 2;
  c.height = size * 2;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#bdbdbd";
  g.fillRect(0, 0, size * 2, size * 2);
  g.fillStyle = "#e8e8e8";
  g.fillRect(0, 0, size, size);
  g.fillRect(size, size, size, size);
  return g.createPattern(c, "repeat");
}

/** Horizontal gradient with checkerboard under transparency (main strip + preset swatches). */
export function paintGradientStrip(
  canvas: HTMLCanvasElement,
  value: GradientStopsValue,
  cssHeight: number,
  cssWidthFallback = 200,
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const cssW = canvas.clientWidth || cssWidthFallback;
  const w = (canvas.width = Math.max(40, Math.floor(cssW * devicePixelRatio)));
  const h = (canvas.height = Math.max(8, Math.floor(cssHeight * devicePixelRatio)));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pat = checkerStyle(Math.floor(6 * devicePixelRatio));
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
  }
  const img = ctx.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    const t = w <= 1 ? 0 : x / (w - 1);
    const [r, g, b, a] = rgbaAt(value, t);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}
