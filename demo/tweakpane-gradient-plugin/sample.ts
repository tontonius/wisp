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
