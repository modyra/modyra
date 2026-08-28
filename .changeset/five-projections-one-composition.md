---
"@modyra/widgets": minor
---

The five per-kind projections compose their description the same way as the shell

Each of `boolean`, `datepicker`, `daterange`, `multiselect` and `timepicker` carried its own copy of
`hasErrors ? errorId : descriptionId` — the rule that makes an error message replace the help, written
out five more times beside the one in the shell. All six now call `fieldDescribedBy`: both, error
first.

Each gains `errorsReserved`, defaulting to whether there are errors to show, so a renderer that draws
the error container only when it has something to say is unaffected — and one that keeps the
container under every field that can fail a rule gets a reference that never changes.

Six copies of one rule is six places for one of them to be corrected and the others not.
