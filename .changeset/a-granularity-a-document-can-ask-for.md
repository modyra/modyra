---
"@modyra/core": minor
"@modyra/widgets": patch
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A granularity a document can actually ask for

The contract, the controller and the dial all honoured a declared granularity and nothing could
declare one. A capability no consumer can reach is a capability nobody has.

- **A document**: `granularity` on a `timepicker` field, in the v2, v3 and v4 JSON schemas. The
  parser refuses one it cannot honour, names the member at fault, and keeps the field — taking the
  form away over a refinement removes something the user can see, over a rule they cannot. The
  refusal reaches a diagnostics sink as `MDY_DYNAMIC_UNHONOURABLE_GRANULARITY`.
- **Angular**: `[granularity]` on `<mdy-control-timepicker>`, carried down to the segments so the
  hour and minute boxes announce their own `step`, `min` and `max` — the platform's own spinner then
  offers what the field offers.
- **Lit**: a `granularity` property.
- **Plain**: read from the field descriptor, so a mounted document carries it.

The validation moved from `@modyra/widgets` to `@modyra/core`, because a document is parsed before
anything renders it and two copies of "does this step divide its unit" is the shape a contract exists
to prevent. `@modyra/widgets` re-exports the same names, so nothing importing them moves.

Also fixed while it was found: the parser **deleted** an unhonourable granularity from the document
it was given. The document belongs to the caller, and a parser that edits it leaves a second read of
the same object answering differently from the first — the rule the file already stated about
duplicate options, broken one function away from where it was written.
