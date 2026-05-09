# Demo/Editor Integration (Wisp Reference)

The editor surfaces are companion tools for authoring `ParticlePreset` data. They are not required for Wisp runtime usage.

The legacy in-demo editor path is deprecated; the active authoring surface is `editor/`.

## What is covered where

- Editor-specific docs now live under [`editor/docs/`](../../editor/docs/index.md).
- Use [Visual Editor (alpha)](../../editor/docs/visual-editor.md) for the standalone `editor/` app.
- Use [Demo Tweakpane Editor](../../editor/docs/demo-tweakpane.md) for the in-demo controls in `demo/main.ts`.

## Runtime mapping notes

Both editor surfaces map controls to standard Wisp preset fields (for example `start`, `forces`, `overLifetime`, `renderer`) and export data compatible with `ParticlePreset`.

Editor preview may use runtime-only helpers such as `wisp.particles.setDebug(...)`, and CPU-only constraints still apply to features like `subEmitters`.

The standalone `editor/` app defaults to a WebGL viewport. For internal WebGPU validation, open it with `?renderer=webgpu` (or `?webgpu=1`) and use the Diagnostics pane to confirm the viewport renderer and resolved particle backend.
