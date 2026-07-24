# Project format

Everything the canvas edits is one JSON-serializable value: an
`MdyStudioProject`, defined in `@modyra/studio-model`. It's the single
source of truth — every target compiles *from* it, nothing is ever
edited as generated code.

```ts
interface MdyStudioProject {
  studioVersion: 1;
  id: string;
  name: string;
  schema: StudioSchemaNode;        // always a group at the root
  formValidators: StudioFormValidator[];
  behaviors: StudioFormBehaviors;  // draft / submit / serverErrorMapping
  implementations: Record<string, StudioImplementationRef>;
  presentation: Record<string, unknown>;
  targets: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
```

## IDs and paths

Every node has a stable ID, generated once and never reused. A node's
*path* (`shipping.city`, `items.0.sku`) is always **derived** from the
current tree shape — moving or renaming a node changes its path but never
its ID, and every reference in the project (a validator's dependency, a
form validator's error target) points at an ID, never a path. This is
why moving a field never breaks the validators pointing at it.

## Symbolic implementations

A `StudioImplementationRef` is never real code — just an ID, a role
(`serverValidator` / `customValidator` / `submitAction`), a display name,
and a mode (`stub` today). Server checks and submit actions reference one
by ID; the actual logic is something a target generates a typed stub for
and a developer fills in, or something Studio's own [Preview
tab](getting-started.md#try-it-live) mocks for testing.

## Loading and validating

`loadProject(raw)` (in `@modyra/studio-model`) is the one function that
turns arbitrary JSON into a trusted project: it checks the shape is
structurally sane, migrates it if it's an older `studioVersion`, then
normalizes it (catching duplicate names, broken references, and other
standing issues) — returning `{ project, diagnostics }`. A structurally
invalid input throws a `StudioModelError` with a real message, rather
than silently producing a half-built project. Studio's own JSON import
and its IndexedDB session-recovery both go through this exact function —
a corrupt snapshot and a corrupt import file degrade identically:
reported, never silently accepted.

## Import and export

**Export** (Export tab → Contract + Studio JSON → `project.mdy-studio.json`)
serializes the project with `serializeProject()` — a deterministic,
recursively key-sorted `JSON.stringify`, so the same project always
serializes to the same bytes regardless of edit history.

**Import** (the header's **Import** button) reads a `.json` file back
through `loadProject()`. A malformed file reports an error and never
touches your current project; a structurally valid but warning-worthy
one (say, a duplicate name) still imports, surfacing the warnings rather
than silently dropping them.

## Storage

Studio auto-saves the current project to **IndexedDB** in your browser
after every edit, and restores it automatically the next time you open
Studio with no project explicitly loaded. `localStorage` is used only for
UI preferences, never project data. See [Security](security.md) for what
that means for sensitive fields.
