# Security

## No `eval`, ever

Studio never executes user-authored or generated logic dynamically — not
in the canvas, not in targets, not in the live Preview. Two places this
matters concretely:

- **Form validators and skip-when conditions** are a portable expression
  tree (`StudioExpression`), never a string of code. Targets *compile* it
  to real source (`compileExpressionToJs`, in generated `.ts` files); the
  Preview tab *interprets* it directly (`evaluateExpression`) — same
  semantics, neither one ever calls `eval`/`new Function`.
- **Server validators, custom validators, and submit actions** are always
  symbolic references (`StudioImplementationRef`). A target generates a
  typed, throwing **stub** for each one — real logic is something a
  developer writes afterward, never something Studio invents or executes
  on their behalf.

## What runs in Preview

The Preview tab's server-validator mock (see
[Validators](validators.md#testing-a-server-validator-without-a-backend))
is entirely local — it never makes a network call, real or otherwise.
"Network failure" mode simulates a rejected promise; it doesn't touch the
network.

## Data at rest

Studio's own project data lives in **IndexedDB**, scoped to your browser
origin — nothing is transmitted anywhere by Studio itself.
**`localStorage`** is used only for UI preferences, never project
content.

Separately, a generated form's own **draft persistence** (`behaviors.draft`,
compiled into a real `draft: {...}` option on the exported form) is a
`@modyra/core` feature that — once you actually run the generated code —
writes to `localStorage` in whatever app hosts it. Studio's own
diagnostics flag a field that looks sensitive (password, token, card
number, …) if it isn't excluded from that draft — a warning, with a
one-click "Exclude from draft" fix, not a silent auto-exclude, since
Studio can't know your naming conventions with certainty. `localStorage`
is plain text and shared by every script on the origin — treat everything
persisted there as readable, exactly as `@modyra/core`'s own security
guide says.

## Import validation

A JSON project import always goes through the real `loadProject()`
loader (structural validation → migration → normalization) — a malformed
or hostile file reports an error rather than being accepted as-is. See
[Project format](project-format.md#loading-and-validating).

## Target output

Every target's conformance suite (see [Plugin
authoring](plugin-authoring.md#the-conformance-suite)) rejects unsafe
file paths — no absolute paths, no `..` traversal — before an `Artifact`
is considered valid, whether the target ships with Studio or is written
by someone else.
