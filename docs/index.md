# Wisp Documentation

This documentation follows the Diataxis shape:

- Tutorials teach by walking through a complete path.
- How-to guides solve specific tasks.
- Reference documents describe every public API surface and option.
- Explanations describe why the system is built the way it is.

Wisp is a modular game-feel effects engine for Three.js.

Current core modules:

- `particles`: Unity/Shuriken-inspired particle authoring with CPU/GPU simulation backends.
- `camera`: trauma-based camera shake designed to layer onto existing camera rigs.

## Start Here

- [Reference: Public API](reference/api.md)
- [Reference: Camera Effects](reference/camera-effects.md)
- [Tutorial: First Particle Effect](tutorials/first-particle-effect.md)
- [How To Add Trauma-Based Camera Shake](how-to/add-camera-shake.md)
- [How To Choose CPU, GPU, Or Auto](how-to/choose-a-backend.md)
- [Explanation: Architecture](explanation/architecture.md)

## Tutorials

- [First Particle Effect](tutorials/first-particle-effect.md)

## How-To Guides

- [Choose A Backend](how-to/choose-a-backend.md)
- [Author A Preset](how-to/author-a-preset.md)
- [Create A GPU Ambient Effect](how-to/create-a-gpu-ambient-effect.md)
- [Use Texture Sheets](how-to/use-texture-sheets.md)
- [Add Trauma-Based Camera Shake](how-to/add-camera-shake.md)
- [Debug Emitters](how-to/debug-emitters.md)
- [Publish The Demo To GitHub Pages](how-to/publish-github-pages.md)

## Reference

- [Public API](reference/api.md)
- [Camera Effects](reference/camera-effects.md)

Particle module reference:

- [ParticlePreset](reference/particle-preset.md)
- [Preset Validation](reference/preset-validation.md)
- [Types And Value Shapes](reference/types-and-value-shapes.md)
- [Emitters](reference/emitters.md)
- [Emission](reference/emission.md)
- [Start Values](reference/start-values.md)
- [Forces](reference/forces.md)
- [Velocity Over Lifetime](reference/velocity-over-lifetime.md)
- [Over Lifetime Curves](reference/over-lifetime.md)
- [Renderer](reference/renderer.md)
- [Texture Sheets](reference/texture-sheets.md)
- [Debug Gizmos](reference/debug-gizmos.md)
- [Lifecycle And Callbacks](reference/lifecycle.md)
- [CPU Backend](reference/cpu-backend.md)
- [GPU Backend](reference/gpu-backend.md)
- [Demo Editor](reference/demo-editor.md)

## Explanations

- [Architecture](explanation/architecture.md)
- [CPU Versus GPU Design](explanation/cpu-vs-gpu.md)
- [Simulation Model](explanation/simulation-model.md)
- [Rendering Model](explanation/rendering-model.md)
- [Known Limitations](explanation/known-limitations.md)
