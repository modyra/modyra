---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/angular": patch
---

A read-only segment means a read-only field, not a visible clock

The number boxes carried `readonly` whenever the dial was the view — so a picker that opens on the
face opened with its two keyboard-usable controls locked. That is also what produced the state class,
which Angular emitted and Lit did not: one renderer painting a state the other never entered.

`readonly` is a declared state of `hourControl` and `minuteControl` now, and it means what it says —
**the field refuses edits** — rather than "the clock is showing". Both renderers derive the class
through `stateClass` from the part that declares it, so neither writes the literal and the two cannot
drift apart again.
