---
"@modyra/widgets": minor
"@modyra/plain": patch
---

A slider stops stating a broken bound before anybody has been near it.

`holdsUneditedValue` takes the kind so that a value which *is* that kind's empty is not read as one
that arrived from a draft — a thumb is always somewhere, so a slider at 0 is the control at rest. The
shell projection passed the kind; the renderer painting the error list did not, so the two disagreed:
the page showed a required-range message on an untouched slider while the control's
`aria-describedby` named nothing, because the projection had decided there was nothing to name.

`visibleErrorsOf` takes an optional kind and plain's text renderer passes it. The error waits for the
person to have had a turn, and the control names it when it arrives.

This was the last finding in `@modyra/plain`'s DOM conformance run, which is now clean.
