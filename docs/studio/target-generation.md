# Target generation

The **Export** tab drives real code-generation targets through a lazy
target registry (`@modyra/studio-codegen`'s `TargetRegistry`). Registering
a target costs nothing — its module only loads the first time you
generate with it — and a target failure is caught and shown as a status
message, never left to corrupt the project you're editing.

## The targets

**Contract + Studio JSON** (`@modyra/studio-target-json`)
: `project.mdy-studio.json` — the raw project, via the same
`serializeProject()` used for [import/export](project-format.md) — and
`contract.json`, the project compiled to the portable Dynamic Form
Contract v2, strict-parsed through the real `@modyra/core` parser (not a
second implementation of it).

**Core** (`@modyra/studio-target-core`)
: `form.ts` — a real `createForm()` definition: every field/group/array
mapped to the actual `@modyra/core` descriptor functions, every validator
to the actual validator function, server validation to the real
`serverValidator()` helper, form validators to `crossField()`. `stubs.ts`
— one typed, throwing function per symbolic implementation reference.
`submit-example.ts` — `form.submit()` wired to the submit stub, only
emitted when the project declares a submit action.

**Angular** (`@modyra/studio-target-angular`)
: The same schema, through `mdyForm()`/`field()`/`group()`/`array()` from
`@modyra/angular/adapter` instead — `form.ts` + `stubs.ts` only, no
submit example (narrower MVP scope than Core). Verified byte-identical
to the Core target's own output once the factory call name is
normalized — the mapping is genuinely shared, not a second
implementation.

**React** (`@modyra/studio-target-react`)
: The same schema again, through `useMdyForm()`. Two real differences
from Core/Angular, not just a renamed import: `useMdyForm` takes the
schema as a thunk (`() => schema`), and — because it's a React Hook, not
callable at module scope the way `createForm`/`mdyForm` are — the output
exports a wrapping `useForm()` hook instead of a bare `const form`.
Validators import from the single `@modyra/react` package too (it
re-exports everything `@modyra/core` does), matching how real
`examples/react` code is written.

## What every target guarantees

Every target passes the same conformance suite before it ships:
**deterministic** (generating twice produces byte-identical output),
**no project mutation**, **safe file paths** (no absolute paths, no `..`
traversal), and a **valid diagnostic shape**. "No unused imports" is
checked for real — the Core/Angular/React targets' generated output is
run through the actual TypeScript compiler in tests, not a
lint-shaped guess.

## Using a generated file

Every file in the Export tab has a **Preview** (see the content inline,
scrollable), a **Copy** button, and **Download**. None of it is
templated string concatenation for the interesting parts — schema and
validator mapping goes through a structured writer
(`@modyra/studio-codegen`), never hand-rolled whole-file templates.
