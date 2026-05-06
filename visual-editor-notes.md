# Visual Editor Notes

- Keep the editor vanilla-first: build one preset from scratch and copy JSON, without preset-library selection flow in the main UX.
- Mirror the particle API in the UI: organize controls into folders that map to `ParticlePreset` categories, and use conditional show/hide controls based on selected mode (for example, emission `rate` vs `burst`).
- Prefer point bindings for paired/vector values (`Point2D`/`Point3D`) instead of separate scalar inputs (for example, burst min/max as one control).
- Use human-readable UI labels (for example, `Noise Strength`) instead of raw API/camelCase names (for example, `noiseStrength`).
- For bezier-based lifetime controls, treat bezier as easing/remap from start→end (sampled into a small curve), not as raw keyframe values; normalize drag values defensively to avoid non-finite keyframes during interaction.
- JSON import/apply still has known flakiness in some paste-and-apply flows (UI state and applied preset can desync); keep this as a follow-up reliability fix before calling import production-ready.
