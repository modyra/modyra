---
"@modyra/plain": patch
---

A field wears the state classes its kind declares

Three states the contract names and this renderer did not apply.

**Open.** `MDY_FIELD_STATE_CLASSES` lists `open` beside `touched` among a renderer root's states and
names the class it takes, and nothing applied it: a select, a datepicker, a timepicker and a colours
field with their popup showing looked exactly like ones with it closed, so a theme had nothing to
style. All six overlay kinds carry it now.

**A refused field's label.** The label's error class read `shownErrorsOf`, which waits for the field
to be touched, while the control's `aria-invalid` does not — so a control marked wrong sat beside a
label that said nothing. Both now answer the same question. A checkbox has no shared shell to apply
it, so it toggles the class itself.

**A lifted label.** A datepicker holding no date compared `selectedDate !== ""` against a value that
is `undefined` when nothing is selected, so an empty field's label was lifted as though it were full.
