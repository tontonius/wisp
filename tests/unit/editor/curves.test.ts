import { describe, expect, it } from "vitest";
import {
  cubicBezierEaseAt,
  curveFromBezierRange,
  curveFromEndpoints,
  normalizeCubicBezierValue,
} from "../../../editor/lib/curves.js";

describe("curves", () => {
  it("curveFromEndpoints has endpoints at 0 and 1", () => {
    const c = curveFromEndpoints(2, 8);
    expect(c[0]).toEqual([0, 2]);
    expect(c[1]).toEqual([1, 8]);
  });

  it("cubicBezierEaseAt is in 0..1 for t in 0..1 with standard ease", () => {
    const bezier: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = cubicBezierEaseAt(t, bezier);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it("curveFromBezierRange produces sorted times", () => {
    const curve = curveFromBezierRange(1, 2, [0.42, 0, 0.58, 1], 5);
    expect(curve.length).toBe(5);
    expect(curve[0][0]).toBe(0);
    expect(curve[curve.length - 1][0]).toBe(1);
  });

  it("normalizeCubicBezierValue parses arrays", () => {
    const t = normalizeCubicBezierValue([0, 0.5, 0.5, 1], [0, 0, 0, 0]);
    expect(t).toEqual([0, 0.5, 0.5, 1]);
  });
});
