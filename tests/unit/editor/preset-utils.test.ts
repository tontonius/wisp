import { describe, expect, it } from "vitest";
import { asRange, clonePreset, ensureEmitter, isPlainObject } from "../../../editor/lib/preset-utils.js";
import type { ParticlePreset } from "../../../src";

describe("preset-utils", () => {
  it("isPlainObject distinguishes plain objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
  });

  it("clonePreset deep-clones plain data", () => {
    const a: ParticlePreset = {
      simulation: "cpu",
      start: { color: "#fff" },
    } as ParticlePreset;
    const b = clonePreset(a);
    b.start = { color: "#000" };
    expect((a.start as { color: string }).color).toBe("#fff");
  });

  it("asRange normalizes number and tuple", () => {
    expect(asRange(3, [0, 0])).toEqual([3, 3]);
    expect(asRange([1, 2], [0, 0])).toEqual([1, 2]);
  });

  it("ensureEmitter creates default sphere emitter", () => {
    const p: ParticlePreset = {};
    const e = ensureEmitter(p);
    expect(e.type).toBe("sphere");
    expect(p.emitter).toBe(e);
  });
});
