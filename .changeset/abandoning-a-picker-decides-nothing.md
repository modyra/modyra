---
"@modyra/lit": patch
"@modyra/widgets": patch
---

Closing an overlay is no longer a validation event.

A user who opened a picker, changed their mind and dismissed it was marked as having *touched* the
field, so a required field they never filled began showing "This field is required" — for deciding
nothing. Six kinds did it: `select`, `multiselect`, `datepicker`, `daterange`, `timepicker` and
`colors`, through the shared dropdown lifecycle and again in each kind's own close path.

The other two renderers already left the field alone, which is how this surfaced: the first action
sequence compared across renderers showed one of them reporting `touched` after open-then-Escape and
the others not. A uniform per-renderer difference rather than a per-kind bug, so it was a decision
rather than a defect — now taken, and the canonical expectation after a dismissed overlay asserts the
resting state rather than declining to say.

`markAsTouched` stays where a field is genuinely left: the blur handlers, and the select adapter's
own `onTouched`.
