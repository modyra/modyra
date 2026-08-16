---
"@modyra/core": minor
---

A form reports what it could not do

A form degrades rather than failing: an async check a reactivity cannot run is skipped, a draft
without effects is not started. Measured side by side, a form whose uniqueness check never ran and one
whose check passed are identical on `valid`, `canSubmit`, `pending`, `errors` and `submitValue()`.

The vocabulary for saying so was already published — `MdyDiagnostics`, `createConsoleDiagnostics`,
`createSilentDiagnostics`, and the codes — and nothing took a sink: the only option accepting one
belonged to an adapter's reactivity. **`createForm` now takes `diagnostics`.** The sink replaces the
console rather than doubling it, and a degradation is reported whether or not this is a development
build: a check that is not running is not a development-time nicety.

**`setInitialValue` accepts an ancestor path**, moving every leaf beneath it to its current value. A
collection's keys are data — a row a user added has a path nobody could have written down — so an API
that names only leaves could never move the baseline of what a user built. Same question as `exclude`
in the draft options, same answer.

**`rebaselineToCurrentValue()` is on the form.** It was published on the engine and announced in a
release note, and the engine behind a form is not the consumer's to reach.
