# Studio overview

Studio is a local-first, visual form builder for Modyra. It runs entirely
in the browser — drag fields onto a canvas, nest them into groups and
arrays, wire up validators and server checks from the inspector, try the
whole thing in a real running preview, then export it to real code.

Everything Studio edits is a single canonical model — an
`MdyStudioProject` — never generated source. The canvas never touches a
`.ts` file directly; targets compile the model into one on export. See
[Project format](project-format.md) for the model itself.

## What's here

| Document | What it covers |
| :--- | :--- |
| [Getting started](getting-started.md) | Launch Studio, build a first form, try the preview, export it |
| [Drag-and-drop editing](drag-and-drop.md) | Pointer drag, the keyboard-only equivalent, undo/redo |
| [Validators](validators.md) | Field, array, cross-field/form, and server validators |
| [Target generation](target-generation.md) | The Export tab — JSON, Core, Angular, React targets, conformance |
| [Project format](project-format.md) | The `MdyStudioProject` model, IDs/paths, serialization, import/export |
| [Plugin authoring](plugin-authoring.md) | Writing a new `StudioTarget` |
| [Security](security.md) | No `eval`, sanitization, what gets persisted where |
| [Accessibility](accessibility.md) | Keyboard parity, live regions, ARIA |

## The shape of it

Studio is a set of small, focused packages, each independently tested:

- `@modyra/studio-model` — the canonical project model: nodes, IDs,
  derived paths, normalize/serialize/migrate.
- `@modyra/studio-editor` — every mutation is an invertible Command, with
  undo/redo history built on top.
- `@modyra/studio-contract` — compiles a project to the portable Dynamic
  Form Contract v2, through the same strict parser `@modyra/core` itself
  uses.
- `@modyra/studio-codegen` — the shared target-platform API (registry,
  conformance suite) and the shared TS-writing plumbing every real-code
  target (Core, Angular, React) reuses rather than duplicates.
- `@modyra/studio-target-json` / `-core` / `-angular` / `-react` — the
  four export targets.
- `@modyra/studio-preview` — builds a real, running `@modyra/core` form
  directly from the model, for the live Preview tab.
- `@modyra/studio-ui` — the vanilla (no framework) canvas shell itself.
- `apps/studio` — the standalone app that bundles and serves `studio-ui`.

Try it: [Launch Studio](https://modyra.github.io/modyra/studio/app/), or
read [Getting started](getting-started.md) first.
