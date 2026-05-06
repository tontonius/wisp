# Visual Editor PRD

## Context

The demo already includes early editor capabilities (parameter controls, preset selection, and live preview), but authoring is still largely form-driven and text-centric. The next step is a dedicated visual editor experience that makes particle effect creation faster, clearer, and more iterative, while keeping the library API (`src/`) stable and first-class.

This PRD defines the product requirements for building that visual editor in the demo app as the primary authoring surface.

## Problem Statement

Current authoring flow has three core limitations:

- Low discoverability for relationships between emitter shape, simulation settings, and rendering outcomes.
- Slow iteration when tuning curves, gradients, and layered behaviors.
- Weak guidance for backend constraints (CPU vs GPU support and caveats) during editing.

The visual editor should reduce trial-and-error cost and help users confidently reach shippable presets.

## Goals

- Make particle authoring visual-first with immediate in-scene feedback.
- Keep preset data model compatible with existing `ParticlePreset` shape.
- Support fast iteration loops: tweak -> preview -> compare -> save/export.
- Expose backend support and limitations during authoring, not after.
- Preserve demo role as showcase + playground + editor without distorting library API design.

## Non-Goals (Initial Delivery)

- Replacing runtime library APIs with editor-only concepts.
- Building a full node-graph editor in v1.
- Supporting every planned roadmap feature (e.g. trails/ribbons/WebGPU) from day one.
- Multi-user collaboration or cloud preset storage.

## Primary Users

- **Game/interactive developers** exploring and tuning effects quickly.
- **Technical artists/designers** shaping style and motion without writing full preset objects by hand.
- **Library contributors** validating new preset fields through real authoring workflows.

## User Stories

- As a user, I can create an effect from scratch using visual controls and see immediate results.
- As a user, I can edit an existing preset and understand which fields are active and supported on my selected backend.
- As a user, I can tune curves and gradients with direct manipulation instead of raw arrays only.
- As a user, I can compare my current edits against a baseline preset and revert specific sections.
- As a user, I can export a clean preset object ready to paste into app code.

## UX Principles

- **Live by default:** every valid edit updates preview immediately.
- **Progressive disclosure:** show essential controls first; advanced controls on demand.
- **State clarity:** always indicate what changed, what is invalid, and what is backend-limited.
- **Authoring safety:** avoid destructive changes without clear confirmation.
- **Parity-first:** keep editor labels and grouping aligned to docs/reference naming.

## Functional Requirements

## 1) Workspace Layout

- Preview viewport with gizmo overlays toggle.
- Left panel: preset structure navigator (sections like Emission, Start Values, Forces, Renderer, etc.).
- Right panel: context-specific property editor for selected section.
- Top bar: preset selector, backend mode selector, play/pause/restart, save/export/import.
- Bottom bar (or side drawer): validation diagnostics and backend support warnings.

## 2) Editing Model

- Two-way binding between UI controls and in-memory preset state.
- Patch-based update mechanism to support undo/redo.
- Reset actions:
  - Reset field to default.
  - Reset section.
  - Reset full preset to baseline.
- Dirty state tracking with clear unsaved indicator.

## 3) Advanced Field Editors

- Curve editor for over-lifetime values.
- Gradient editor for color over lifetime.
- Min/max random range controls with linked/unlinked editing.
- Structured editor for vectors (`Vector2/3`) and common distributions.
- Raw JSON view (read/write) for advanced users with validation on apply.

## 4) Validation and Diagnostics

- Real-time schema validation with actionable error messages.
- Warning tier for suspicious values (extreme spawn rates, contradictory settings).
- Backend compatibility checks (CPU/GPU support) per field/section.
- Diagnostic click-through: selecting an issue focuses the related control.

## 5) Preview and Simulation Controls

- Play/pause/stop/restart controls.
- Time scale control for slow-motion tuning.
- Emission stress-test quick action (temporary burst multiplier).
- Camera helpers for inspecting shape/spawn behavior (orbit reset, focus emitter).

## 6) Preset Lifecycle

- Load built-in demo presets.
- Duplicate preset as working copy.
- Save local working preset in browser storage.
- Export as TS object or JSON.
- Import from JSON with migration/validation feedback.

## 7) Compare and Review

- Side-by-side or toggle compare against baseline preset.
- Visual diff for changed sections/fields.
- "Copy changed fields" output mode for minimal patch sharing.

## Technical Requirements

- Must operate inside existing demo architecture (`demo/`) with minimal disruption.
- Keep canonical preset shape aligned with library `ParticlePreset` contracts in `src/`.
- Editor state should be serializable for persistence and potential share links later.
- Maintain good runtime performance while editing (avoid unnecessary full re-instantiation when patching can be incremental).
- Add a modular editor UI structure so future roadmap features can add panels/controls cleanly.

## Data Model Requirements

- `baselinePreset`: immutable source loaded from selected preset.
- `workingPreset`: mutable editor state.
- `changeSet`: field-level diff metadata for dirty tracking and compare view.
- `validationState`: errors/warnings with paths and backend context.
- `uiState`: panel visibility, selection, tool mode, and transient editor interactions.

## Phased Delivery Plan

## Phase 1: Foundation (MVP)

- Workspace layout with section navigator and property panel.
- Live editing for core fields already supported in demo controls.
- Real-time validation panel.
- Undo/redo and dirty state.
- Load/duplicate/export basic flow.

**Exit criteria**

- User can author and export a non-trivial preset without touching source code.

## Phase 2: Authoring Depth

- Curve/gradient editors.
- Compare mode with baseline.
- Backend compatibility surfacing at field level.
- Import with migration hints.

**Exit criteria**

- User can tune over-lifetime effects and resolve backend limitations without docs-hunting.

## Phase 3: Polishing and Scale

- Better warnings/heuristics and performance overlays.
- Strong keyboard ergonomics and accessibility pass.
- Optional shareable serialized state format.
- Extended support for new roadmap features as they land.

**Exit criteria**

- Visual editor becomes the default recommended authoring path in docs.

## Success Metrics

- Time-to-first-custom-effect reduced versus current form-only flow.
- Higher completion rate for exporting valid presets.
- Fewer validation errors at export time.
- Increased usage of advanced features (curves/gradients) in saved presets.

## Risks and Mitigations

- **Risk:** UI complexity overloads new users.  
  **Mitigation:** progressive disclosure and sensible defaults.

- **Risk:** Editor diverges from runtime capabilities.  
  **Mitigation:** field-level capability metadata sourced from shared definitions where possible.

- **Risk:** Frequent re-init hurts preview performance.  
  **Mitigation:** incremental application path and update batching.

- **Risk:** Schema churn breaks saved editor state.  
  **Mitigation:** versioned import format + migration layer.

## Open Questions

- Should shareable presets use URL compression in Phase 3 or local-only first?
- How much of validation metadata can be centralized in library-side definitions?
- Do we want optional "guided templates" (fire, smoke, sparks) in MVP or later?
- What level of mobile/tablet support is required for the editor UI?

## Acceptance Criteria (for this PRD scope)

- A clear MVP scope exists with prioritized phases.
- Functional requirements define layout, editing model, validation, preview, and lifecycle.
- Non-goals prevent scope creep into node graph and platform concerns.
- Success metrics and risks are explicit enough to guide implementation trade-offs.
