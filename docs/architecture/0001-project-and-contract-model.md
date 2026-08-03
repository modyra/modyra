# ADR 0001: Project & Contract model

Status: Accepted (P0)

## Context

Studio is a visual editor that must produce deterministic, compilable code for
multiple targets (Core, Angular, React, later Java) from a single canvas model.
We need one authoritative representation the canvas edits, and a separate,
strictly derived representation that targets consume — otherwise editor state
and generated output drift, or the canvas ends up understanding target-specific
code shapes.

## Decision

- `MdyStudioProject` (plan section 5) is the single canonical source of truth.
  The canvas, undo/redo, and all editor commands (ADR 0003) operate exclusively
  on this structure. The canvas never edits generated source (R1).
- `Contract v2` is a one-way, deterministic derived export: `Project -> Contract`.
  It strips all editor-only metadata (presentation, IDs not needed downstream,
  Studio bookkeeping) and is validated by strict-parsing it with the existing
  Contract parser before it is trusted by any target.
- Round-tripping is defined only as `StudioProject JSON -> StudioProject JSON`
  (save/load/import/export). Studio never imports arbitrary source and
  reverse-engineers a project from it (R13) — that direction is explicitly out
  of MVP scope (plan section 3).
- `targets: Record<string, unknown>` on the project holds only target-specific
  *options* (e.g. chosen output style), never target-specific *model* data —
  target logic lives in target plugins (ADR 0004), not in the project shape.

## Consequences

- Every feature ships as a project-model change first; Contract mapping (or an
  explicit "unsupported" diagnostic) is part of the definition of done for any
  new node/validator kind (plan section 15).
- Editor bugs and codegen bugs are separable: if Contract strict-parses and a
  target fixture still produces wrong output, the bug is in that target's
  pipeline (ADR 0004), not in the model.
- Adding a wholly new output shape (e.g. a future "form JSON schema" export)
  only requires a new `Project -> X` mapping function, no canvas change.

## Rejection-test answers (plan section 2)

- **Java addable without canvas model change?** Yes — Java consumes
  `Contract`/`Project` JSON exactly like Core/Angular/React; nothing in this
  ADR is JS/TS-specific.
- **Target loads lazily, no hardcoded UI import?** N/A to this ADR directly —
  see ADR 0004.
- **Rename/move preserves all references?** N/A to this ADR directly — see
  ADR 0002.
- **Same normalized project → byte-identical output?** Yes by construction:
  `Contract v2` and every target artifact are pure functions of
  `MdyStudioProject`; see `../checkout-example.md` for a concrete instance with
  no non-deterministic fields (no timestamps, no insertion-order-dependent
  data).

## Satisfies

R1, R10, R13.
