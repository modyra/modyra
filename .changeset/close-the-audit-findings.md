---
"@modyra/core": patch
"@modyra/widgets": patch
"@modyra/angular": patch
---

Six findings from a pre-release audit, closed.

**One projection decides what a control exposes.** `projectFieldA11y` no longer spells the state and
constraint attributes: it asks `projectFieldShellA11y`, which is where a renderer that binds a part
reads them. Two projections emitting the same attributes is how they come to disagree — measured
identical across all thirteen attributes before and after, so nothing moved but the ownership.

**A fact no control can act on is no longer carried.** `MdyFieldConstraints.inputType` travelled from
`email()` through the whole pipeline and was deliberately dropped at the end: the kind decides what
an input *is*, and a rule that could change it would let a validator turn a text field into
something else. `email()` keeps asking for the right keyboard (`inputMode`), which is applied.

**Removed**: `applyNativeConstraints`, exported and used by nobody since the projection took over
placing attributes. **Removed**: a dead `native` computed left in the Angular textarea by the same
change.

**Tested directly rather than from above**: `withFacts` (including that it does not tag the function
it is given), `factsOf` (including the marker adapters set before this module existed), `mergeFacts`
(tightest end, non-finite dropped, two patterns cancelling), `factsOfAll`, `nativeConstraintAttributes`
per kind, and `narrowConstraints` — which can tighten an end and never widen one.

**Documented**: the date and time kinds derive no native constraints yet. Their inputs have
`min`/`max`/`step` too, expressed as dates, and that crossing is not done.
