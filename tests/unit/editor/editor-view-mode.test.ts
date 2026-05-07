import { describe, expect, it } from "vitest";
import { EditorViewState } from "../../../editor/state/editor-view-mode.js";

describe("EditorViewState", () => {
  it("defaults to particles mode", () => {
    const state = new EditorViewState();
    expect(state.current).toBe("particles");
    expect(state.isParticlesMode()).toBe(true);
  });

  it("switches between particles and motion test", () => {
    const state = new EditorViewState();
    expect(state.setMode("motionTest")).toBe(true);
    expect(state.current).toBe("motionTest");
    expect(state.isMotionTestMode()).toBe(true);

    expect(state.setMode("particles")).toBe(true);
    expect(state.current).toBe("particles");
    expect(state.isParticlesMode()).toBe(true);
  });

  it("tracks deferred particle respawn flags while in motion mode", () => {
    const state = new EditorViewState();
    state.setMode("motionTest");
    state.markParticlesDirty();
    expect(state.consumeParticlesDirty()).toBe(true);
    expect(state.consumeParticlesDirty()).toBe(false);
  });
});
