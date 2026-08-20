# @modyra/studio-model

## 0.6.0

### Minor Changes

- 5a95871: A schema node the model cannot hold is refused where the project is opened

  A Studio project is a file: saved, committed, hand-edited, written by an older editor and read by a
  newer one. `loadProject` refused what it could not use at the **root** and said so by name — not an
  object, no valid schema root, a `studioVersion` from the future. Below the root it trusted the type.

  A field node with no `name` loaded without a diagnostic and reached the generator, which emitted a
  schema keyed by `undefined`: valid TypeScript declaring a field nobody wrote, so "the generated code
  compiles" stayed true about a form that is nonsense. A node missing its `validators`, or a group
  missing its `children`, came out as a raw `TypeError` from inside a walk — at a door that has a
  refusal with its own name.

  Every node under the root is now held to the rules the root already applies: it is an object, it
  declares a known node type, and it carries a string `id` and `name`; a field carries its `validators`,
  a group its `children`, an array its `validators` and its `item`. Refused rather than reported,
  because that is what this door already does with a project it cannot use.

  The walk is iterative and stops at a node it has already seen — a project is a file anyone may edit,
  so its nesting must not decide how much call stack this takes, and the cyclic and too-deep refusals a
  few lines below are the ones a reader should get.

  A field whose **kind** the editor does not know is deliberately not refused here: `compileToContract`
  reports it as `UNSUPPORTED_FIELD_KIND` and degrades the field to text, so the author can open the file
  and fix it.

- a9f1f37: Studio draws the nesting the engine runs

  `@modyra/core` lifted the one-positional-level rule and the depth cap (ADR 0043), and Studio stated
  the old rule in three places: `ArrayNode.item` excluded another array, the editor refused to insert
  one, and the compiler reported `UNSUPPORTED_NESTING` and emitted nothing for that branch.

  An array's row is any schema node now, the editor inserts what a project declares, and the compiler
  emits the nesting. `UNSUPPORTED_NESTING` is gone: no shape produces it, so a consumer matching on the
  code will never see it again.

- 9116bde: Studio can author a keyed collection

  `RecordNode` joins `ArrayNode` in the project model, and a collection's row may itself be a
  collection. The compiler emits the contract's `record` node, codegen emits `record(...)` with the
  rows the author declared as `initial`, the index walks a row template of either kind, and the
  preview draws a keyed collection from the keys its handle reports rather than from a row count.

  One rule holds across the pipeline: a path crosses **one** positional level. An array below another
  array is refused at compile with `UNSUPPORTED_NESTING`, naming the node that declared it, and
  nothing unaddressable is emitted.

### Patch Changes

- 6e672c5: A layout nobody can walk is dropped and named, instead of crashing a package downstream

  Two ways an arrangement stopped a host.

  **The depth guard was defeated by depth.** `STUDIO_LAYOUT_MAX_DEPTH` is a judgement about
  arrangement — six levels is more than a form should need, and past it the walk reports and carries
  on. What can be _processed_ is a different question: `structuredClone` recurses, so a layout a few
  thousand levels deep raised a `RangeError` **inside the clone**, before any guard ran.

  ```
  depth 8      LAYOUT_TOO_DEEP reported, project handed on
  depth 4000   RangeError
  ```

  A project that deep is what a generator, an import or a loop in an editor produces, and the
  difference between a diagnostic and a `RangeError` is the difference between a message and a host
  that stopped.

  **A section dropped into itself** — what a drag produces — survived, because `structuredClone`
  _preserves_ cycles rather than breaking them. It was reported as `LAYOUT_TOO_DEEP`, which is
  technically true and the wrong message: a reader goes looking for a deep nesting they do not have.
  The crash then landed one package later, in `arrangementDiagnostics`, counting something that has no
  count.

  A layout is now walked over an explicit stack on the **raw input, before the clone** — a guard that
  runs after the clone is one the clone can defeat. A cycle is reported as `LAYOUT_CYCLE`, a layout
  past the structural bound as `LAYOUT_TOO_DEEP`, and in both cases the layout is dropped and the
  project opens: this module's own rule is that a stale arrangement degrades to "unarranged" and never
  blocks opening a project.

  A layout that is merely deeper than the arrangement bound is unaffected — it still loads, with its
  warning and its layout.

  Found by `battle-tests/adversarial/studio/`.

- 9191632: A project file cannot put code into the module Studio generates

  `compileExpressionToJs` printed a literal operand as `String(operand)` when it was not a string. An
  array is its own join:

  ```js
  // project.json → condition.operands[1] = ["globalThis.taken = 1"]
  value["a"] === globalThis.taken = 1
  ```

  An assignment, in a module a consumer compiles and ships, decided by a file that arrives from a
  repository, a template or an export. `["fetch('//elsewhere')"]` gets there the same way; an object
  gives `[object Object]`, which is the same defect failing loudly. `loadProject` accepted such a
  project and reported **zero diagnostics**, so nothing between the file and the generated code said a
  word.

  An operand is now printed by its kind: a string as an escaped string literal, a finite number and a
  boolean as themselves, and anything else — an array, an object, a function, `NaN`, `Infinity` —
  raises. `loadProject` reports `BAD_CONDITION_OPERAND` for the same values, reported rather than
  thrown, because a project that cannot be opened cannot be repaired in the editor that reports it.

  Both ends deliberately: the editor holds a file someone can fix, and every codegen target reaches the
  compiler directly without loading a project through the model.

  **The four kinds a condition holds compile exactly as before** — that is pinned, since reaching
  further would rewrite conditions that were always correct.

  Recorded as [ADR 0056](https://github.com/modyra/modyra/blob/main/docs/architecture/0056-a-project-file-does-not-decide-what-the-generated-module-does.md).

- 178ddce: Studio reports an option list a form cannot render: two options sharing a value, and a value carrying
  a space or the `__` that separates the parts of a generated id. An option's value becomes part of its
  id, so a shared value is a shared id — the rendered list is short one option and a keyboard lands on
  whichever the DOM found first — and a space splits the ARIA reference that points at it, because
  those attributes are space-separated lists of ids. Both compiled without a word beside the empty
  list, which the compiler already refuses.
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

## 0.5.0

### Minor Changes

- 207901b: A field decides whether the devtools panel shows its value

  The panel masked values by matching the field's name against a regex — `password`, `token`, `iban`
  and a handful more — and nothing could overrule it. A guess is right often enough to be useful and
  wrong in both directions often enough to matter: `notes` can hold a recovery phrase and was printed
  in full, while `cardStyle` was masked for containing "card".

  `MdyDynamicField` gains an optional `sensitive`, and `mdyFormSnapshot` takes a `sensitive(path)`
  lookup. `isSensitivePath(path, declared)` is the rule in one place: a declaration wins, and the name
  heuristic only fills the silence — so nothing changes for a field that says nothing.

  In Studio, each field carries an eye beside its required marker. It cycles through three states
  rather than two, because "guess from the name" is a real answer and the one every field starts with:
  guess → shown in the clear → hidden → guess. A two-state toggle would make the heuristic unreachable
  the moment you touched it.

- 7cec920: Studio's model can hold a per-breakpoint layout, and compiles to the version that says it

  `StudioLayoutColumns` had no `at`, so a row's track count could not be authored even though Contract
  v2 had carried it for some time, and a slot had nowhere to say where it sits or whether it shows. The
  model now holds both: `at` on the row, and `at` on the slot.

  `StudioLayoutSlot` extends `NodeRef` rather than replacing it, so every `"nodeId" in child` reading
  of a layout keeps working and a slot with nothing to say still serializes as the `{ nodeId }` it
  always was.

  **The compiled version is the lowest one that can say what the project says.** A row's track count is
  v2's own feature and compiles to v2; only a slot that places or hides itself raises the document to
  v3. A form that never touches a breakpoint produces the same v2 document it produced before — no
  stored contract, SDK, or target has to change because v3 exists. `CompileResult.contract` widens to
  `StudioContract`, the union of the two.

  Placement that a row could not honour — a column past its tracks, a size that says neither `column`
  nor `hidden` — is dropped rather than compiled, because a half-finished edit in the canvas is the
  ordinary way to produce one and it must never cost the author their form.
