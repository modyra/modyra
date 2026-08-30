---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

Reading a form is not declining it

A required field that somebody tabs through and leaves empty no longer announces itself invalid.
Focus arriving and leaving is an act on attention, not on the value: Tab is how a person reads a
form, the way eyes scroll it, and somebody tabbing past twenty required fields to learn what is being
asked was collecting twenty verdicts about fields they were about to fill in. A sighted person
scrolling the same form gets no red borders. ADR 0167 decided this; this release implements it.

**What changed is what sets `touched`.** A bare blur no longer marks a field touched — in any
controller, in any renderer. Every path that changes the value marks it, together with `dirty`,
because they are one act: `touched` now means *this field has had an answer*, not *focus has been
here*. A refused submit still marks every field, so the form still says everything at once when it is
asked and refuses.

Consequences for a consumer reading `handle.touched()`: it stays false through a traversal that
changed nothing, and it is true after any edit — including an edit that put the value back. Anything
keyed off it (a `--touched` class, a custom verdict rule) follows that meaning.

Also fixed: a date range committed its text on the way out of the field, and an empty box committed
"empty" over an end that was already empty — so a traversal registered as an act. Empty to empty is
nothing happening.
