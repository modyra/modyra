# ADR 0004: Target plugin API

Status: Accepted (P0)

## Context

Studio must ship Core/Angular/React targets at 0.1 and add React-dynamic and
Java later, without the canvas, command engine, or diagnostics ever knowing
those targets exist. If a target were hardcoded into the editor, adding Java
would mean forking or branching the canvas — which R5/R12 explicitly forbid.

## Decision

- A target is `StudioTarget<T>` (plan section 10): `id`, `displayName`,
  `version`, `capabilities`, `defaults()`, `analyze(project, options)`,
  `generate(project, options)`. It receives `MdyStudioProject` (or its
  `Contract` derivation) and returns an `Artifact` (`targetId`, `files[]`
  with `path`/`language`/`content`/`role`, `diagnostics`, optional
  `entryFile`).
- Targets are discovered through a `TargetManifest { id, displayName,
  load(): Promise<StudioTarget> }` registry. The editor holds manifests, not
  target implementations, until a target is actually invoked — `load()` is
  called lazily (R5). No target package is imported eagerly by editor code.
- Generation pipeline is fixed and shared: normalize → resolve IDs to paths →
  capability analysis → target-specific IR → AST/structured writer → print →
  format → syntax check → optional compile → `Artifact`. Complex source is
  never produced by ad hoc string templates (R10); a shared TS IR factory
  covers `createForm`/`mdyForm`/`useMdyForm` (plan section 10).
- Explicit forbidden dependency edges (plan section 4), restated here as the
  authoritative list for this ADR's scope:
  - `model -> DOM/React/Angular/Astro/target` — forbidden.
  - runtime package (`packages/core`, adapters, etc.) `-> Studio` — forbidden
    in either direction of authority: runtime never imports Studio (R12).
  - `target -> Studio UI` — forbidden; a target only depends on
    `studio-model`/`studio-codegen`/`studio-target-core`, never on
    `studio-ui-react` or `apps/studio`.
- Target incompatibility with a given model shape is a diagnostic the target
  reports via `analyze`, not a canonical-model constraint (ADR 0003)  — the
  canvas stays valid even if the currently-selected target can't yet support
  every feature used.
- Every target must pass the conformance suite (plan section 10):
  deterministic, no project mutation, safe paths, stable diagnostics,
  unsupported-feature reporting, stale/cancel handling, fixture compiles.

## Consequences

- Adding Java (P14) means adding one more `TargetManifest` entry and one
  `packages/studio-target-java` package; zero edits to
  `studio-model`/`studio-editor`/`studio-ui-react`.
- Generation must run off the main thread (workers, plan section 11) with a
  generation ID so a stale in-flight generation from a since-changed project
  is discarded — this is a target-plugin-API concern (result identity), not
  a UI concern.
- A target that needs a model feature that doesn't exist yet is a model
  change proposed through ADR 0001/0002, not a special case bolted onto the
  target API.

## Rejection-test answers

- **Java addable without canvas model change?** Yes — this ADR's entire
  point is that `StudioTarget<T>`/`Artifact`/manifest registry are the only
  surface a target touches; nothing here is JS-shaped (`files[]` content is
  opaque text, `language` is just a string like `"java"`).
- **Target loads lazily, no hardcoded UI import?** Yes: `TargetManifest.load()`
  is the only load path; the editor never statically imports a target
  package.
- **Rename/move preserve all references?** N/A to this ADR directly — see
  ADR 0002 (targets consume the already-resolved model/Contract, so they
  never see raw path drift).
- **Same normalized project → byte-identical output?** Yes: `generate` is
  specified as deterministic and non-mutating per the conformance suite;
  given `../checkout-example.md` unchanged, any target run twice produces
  identical `Artifact.files[].content`.

## Satisfies

R5, R10, R11 (no eval/remote plugins — `load()` is a static import
resolved by the manifest, not dynamic code fetched at runtime), R12.
