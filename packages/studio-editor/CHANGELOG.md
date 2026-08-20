# @modyra/studio-editor

## 0.6.0

### Minor Changes

- a9f1f37: Studio draws the nesting the engine runs

  `@modyra/core` lifted the one-positional-level rule and the depth cap (ADR 0043), and Studio stated
  the old rule in three places: `ArrayNode.item` excluded another array, the editor refused to insert
  one, and the compiler reported `UNSUPPORTED_NESTING` and emitted nothing for that branch.

  An array's row is any schema node now, the editor inserts what a project declares, and the compiler
  emits the nesting. `UNSUPPORTED_NESTING` is gone: no shape produces it, so a consumer matching on the
  code will never see it again.

### Patch Changes

- 32ae232: A sequence command looks at every step, and an advisory one no longer hides an invalid one

  `createSequenceCommand.validate` threads the project through each step — the careful half — and
  returned at the first step that produced **anything**, whatever its severity. `CommandHistory` rejects
  on an _error_, so the two together meant:

  ```
  one invalid step               →  CommandRejectedError
  advisory first, invalid last   →  applied, all three steps
  ```

  Latent today, because every diagnostic in `commands.ts` goes through one helper that hardcodes
  `severity: "error"` — which is exactly why it is worth being right about now. The day a warning is
  added, sequences stop being validated, and nothing about that change looks like it touches sequences.

  Every step's findings are collected now. An **error** still stops the walk, because a step that must
  not apply cannot be threaded through to give the next one a project to look at; an advisory is
  collected and the walk goes on.

  Found by `battle-tests/adversarial/studio/`.

- 1e91463: One bound for how deep a schema may go, and a schema nobody can clone is refused

  A project carries **two** nested structures through the same `structuredClone`. The layout was
  guarded ahead of it; the schema went on reaching the identical frame:

  ```
  depth 32    loads clean
  depth 40    loads clean, nothing reported
  depth 4000  RangeError, from inside the clone
  ```

  Both structures gave way at the same threshold, which is what says it is one frame one structure
  over rather than two defects that look alike.

  **The schema is walked on the raw input before the clone**, over an explicit stack. Past what can be
  processed the project is **refused** rather than degraded — a schema is not arrangement, and a
  project without one is not a project — and a schema containing itself is refused by name rather than
  reported as depth.

  **And the two packages disagreed about how deep a schema may be.** `@modyra/studio-editor` refuses to
  _place_ a node past 32 levels, so nothing built in a session goes deeper, while the loader accepted
  any depth from a file and said nothing — so an import or a generator produced a project nobody could
  then edit, silently. `STUDIO_SCHEMA_MAX_DEPTH` now lives in `@modyra/studio-model`, the editor reads
  it instead of declaring its own, and the loader reports `SCHEMA_TOO_DEEP` past it.

  Reported rather than refused, because an import can legitimately be deeper and the value is the
  author's — but a project their editor cannot open is something they have to be told about.

  The bound is counted the way a placement is: `validatePlacement` accepts a leaf under `root + 31`
  groups and refuses it under `root + 32`, and the loader now changes its answer at exactly that
  point. Two bounds meaning different things by "depth" agree on the number and disagree by one, which
  is the kind of difference nobody finds until a project sits on it.

  Found by `battle-tests/adversarial/studio/`.

- Updated dependencies [6e672c5]
- Updated dependencies [5a95871]
- Updated dependencies [9191632]
- Updated dependencies [178ddce]
- Updated dependencies [1e91463]
- Updated dependencies [a9f1f37]
- Updated dependencies [9116bde]
  - @modyra/studio-model@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [207901b]
- Updated dependencies [7cec920]
  - @modyra/studio-model@0.5.0
