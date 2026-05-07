export type EditorViewMode = "particles" | "motionTest";

/** Small state container to keep view switching logic out of editor bootstrap. */
export class EditorViewState {
  private mode: EditorViewMode = "particles";
  private particlesDirty = false;

  get current(): EditorViewMode {
    return this.mode;
  }

  setMode(mode: EditorViewMode): boolean {
    if (this.mode === mode) {
      return false;
    }
    this.mode = mode;
    return true;
  }

  markParticlesDirty(): void {
    this.particlesDirty = true;
  }

  consumeParticlesDirty(): boolean {
    if (!this.particlesDirty) {
      return false;
    }
    this.particlesDirty = false;
    return true;
  }

  isParticlesMode(): boolean {
    return this.mode === "particles";
  }

  isMotionTestMode(): boolean {
    return this.mode === "motionTest";
  }
}
