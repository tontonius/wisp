import * as THREE from "three";
import type { Curve } from "../../src";
import type { CubicBezierTuple } from "../types";

export function curveFromEndpoints(start: number, end: number): Curve {
  return [
    [0, start],
    [1, end],
  ];
}

function cubicBezierPoint(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return (u * u * u * p0)
    + (3 * u * u * t * p1)
    + (3 * u * t * t * p2)
    + (t * t * t * p3);
}

function cubicBezierSlope(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return (3 * u * u * (p1 - p0))
    + (6 * u * t * (p2 - p1))
    + (3 * t * t * (p3 - p2));
}

/** Exported for unit tests. */
export function cubicBezierEaseAt(t: number, bezier: CubicBezierTuple): number {
  const [x1, y1, x2, y2] = bezier;
  const targetX = Math.min(1, Math.max(0, t));

  let u = targetX;
  for (let i = 0; i < 6; i++) {
    const x = cubicBezierPoint(0, x1, x2, 1, u);
    const dx = cubicBezierSlope(0, x1, x2, 1, u);
    const err = x - targetX;
    if (Math.abs(err) < 1e-6) break;
    if (Math.abs(dx) < 1e-7) break;
    u -= err / dx;
    u = Math.min(1, Math.max(0, u));
  }

  const testX = cubicBezierPoint(0, x1, x2, 1, u);
  if (!Number.isFinite(testX) || Math.abs(testX - targetX) > 1e-4) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) * 0.5;
      const midX = cubicBezierPoint(0, x1, x2, 1, mid);
      if (midX < targetX) lo = mid;
      else hi = mid;
    }
    u = (lo + hi) * 0.5;
  }

  const y = cubicBezierPoint(0, y1, y2, 1, u);
  return Number.isFinite(y) ? y : targetX;
}

export function curveFromBezierRange(start: number, end: number, bezier: CubicBezierTuple, samples = 5): Curve {
  const count = Math.max(2, samples);
  const curve: Curve = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const eased = cubicBezierEaseAt(t, bezier);
    const value = THREE.MathUtils.lerp(start, end, eased);
    curve.push([t, Number.isFinite(value) ? value : start]);
  }
  return curve;
}

export function normalizeCubicBezierValue(value: unknown, fallback: CubicBezierTuple): CubicBezierTuple {
  if (Array.isArray(value) && value.length === 4) {
    const tuple = value.map((v) => Number(v)) as CubicBezierTuple;
    if (tuple.every((v) => Number.isFinite(v))) return tuple;
  }
  if (value && typeof value === "object") {
    const candidate = value as {
      x1?: unknown;
      y1?: unknown;
      x2?: unknown;
      y2?: unknown;
      x?: unknown;
      y?: unknown;
      z?: unknown;
      w?: unknown;
    };
    const fromNamed: CubicBezierTuple = [
      Number(candidate.x1),
      Number(candidate.y1),
      Number(candidate.x2),
      Number(candidate.y2),
    ];
    if (fromNamed.every((v) => Number.isFinite(v))) return fromNamed;
    const fromXYZW: CubicBezierTuple = [
      Number(candidate.x),
      Number(candidate.y),
      Number(candidate.z),
      Number(candidate.w),
    ];
    if (fromXYZW.every((v) => Number.isFinite(v))) return fromXYZW;
  }
  return fallback;
}
