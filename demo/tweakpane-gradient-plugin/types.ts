/**
 * External value for the gradient editor: color keyframes and opacity keyframes
 * over normalized lifetime `t` in [0, 1].
 *
 * Maps cleanly to particle preset `overLifetime.color` and `overLifetime.opacity`.
 */
export type GradientStopsValue = {
  colors: Array<[t: number, color: string]>;
  opacities: Array<[t: number, opacity: number]>;
};

export const defaultGradientStops = (): GradientStopsValue => ({
  colors: [
    [0, "#ffffff"],
    [0.45, "#70e7ff"],
    [1, "#ff7ad9"],
  ],
  opacities: [
    [0, 0],
    [0.12, 1],
    [1, 1],
    [1, 0],
  ],
});

export function cloneGradientStops(value: GradientStopsValue): GradientStopsValue {
  return {
    colors: value.colors.map(([t, c]) => [t, c] as [number, string]),
    opacities: value.opacities.map(([t, o]) => [t, o] as [number, number]),
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function isTupleArray<T>(v: unknown, elem: (x: unknown) => x is T): v is T[] {
  return Array.isArray(v) && v.length > 0 && v.every(elem);
}

function isColorStop(x: unknown): x is [number, string] {
  return (
    Array.isArray(x) &&
    x.length === 2 &&
    typeof x[0] === "number" &&
    typeof x[1] === "string"
  );
}

function isOpacityStop(x: unknown): x is [number, number] {
  return (
    Array.isArray(x) &&
    x.length === 2 &&
    typeof x[0] === "number" &&
    typeof x[1] === "number" &&
    !Number.isNaN(x[0]) &&
    !Number.isNaN(x[1])
  );
}

export function isGradientStopsValue(v: unknown): v is GradientStopsValue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return isTupleArray(o.colors, isColorStop) && isTupleArray(o.opacities, isOpacityStop);
}

/** Sort by time, clamp coordinates, enforce at least two stops per channel. */
export function normalizeGradientStops(v: unknown): GradientStopsValue {
  const base = defaultGradientStops();
  if (!isGradientStopsValue(v)) return base;

  const colors = [...v.colors]
    .map(([t, c]) => [clamp01(t), c] as [number, string])
    .sort((a, b) => a[0] - b[0]);
  const opacities = [...v.opacities]
    .map(([t, o]) => [clamp01(t), clamp01(o)] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  return {
    colors: colors.length >= 2 ? colors : base.colors,
    opacities: opacities.length >= 2 ? opacities : base.opacities,
  };
}

export function gradientsEqual(a: GradientStopsValue, b: GradientStopsValue): boolean {
  if (a.colors.length !== b.colors.length || a.opacities.length !== b.opacities.length) return false;
  for (let i = 0; i < a.colors.length; i++) {
    if (a.colors[i][0] !== b.colors[i][0] || a.colors[i][1] !== b.colors[i][1]) return false;
  }
  for (let i = 0; i < a.opacities.length; i++) {
    if (a.opacities[i][0] !== b.opacities[i][0] || a.opacities[i][1] !== b.opacities[i][1]) return false;
  }
  return true;
}
