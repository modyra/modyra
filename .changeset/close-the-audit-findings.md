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

Two more, found by a second sweep of the places the first one did not reach:

- **`useMdyField` now carries `required` and `constraints`** in `@modyra/react` and `@modyra/preact`.
  Those adapters exist so the caller writes the input, and their hand-enumerated snapshot did not
  include what a control needs to draw itself — so a constraint declared once was enforced and
  unshowable there. Vue, Solid and Svelte hand back the handle and were never affected.
- **A condition now has a test for the path a restored draft takes.** `enableDraft` restores through
  `patchValue`; every conditional case asserted a value typed into the form, so a form resumed from a
  draft was the one path nothing covered.

`@modyra/standard-schema` deliberately gains nothing: the Standard Schema V1 contract exposes only
`~standard.validate`, so there is no `.min(3)` to read. Zod could cross over because Zod publishes
its checks.

A defect the demos found the moment they showed the feature:

**`minLength` refused an empty field.** Its own documentation said the opposite, and `<input
minlength>` agrees with the documentation — the platform does not apply it to an empty value, because
that is `required`'s question. A collection is the other way round: `minLength(1)` on an array is how
"at least one row" is said, and exempting `[]` would take that away. So the rule now reads: **a blank
field is not short, it is empty; an empty collection is short.**

Also: `@modyra/angular`'s `group()` wrapper dropped the `when` option, which would have made an
Angular schema quietly poorer than every other adapter's.
