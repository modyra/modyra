---
"@modyra/widgets": minor
"@modyra/lit": patch
---

The same gesture, executed by every renderer: open an overlay, dismiss it from the keyboard.

`MDY_CANONICAL_AFTER_ESCAPE` is the first expectation about what a widget *does* rather than what it
looks like in a state it was put into, and `MdyStateFixture` gains `press` so the sequence can be
expressed once and run by all three adapters. It replaces a hand-written Escape test that each
adapter kept its own copy of — three tests that agreed on the transition and each asserted only that
`aria-expanded` became false.

That is why five kinds could strand the keyboard and stay green. Dismissing an overlay left focus on
the document body, dropping the user at the top of the page with no way back to the field they were
in: Lit's `multiselect` and `colors`, Angular's `select`, `datepicker` and `daterange`.

**Lit's two are fixed here.** Focus returns to the opener, and deliberately only on keyboard
dismissal — folding it into `close` would yank focus away from wherever the user clicked when the
overlay closes because they clicked outside it.

Angular's three are recorded, not fixed: they close through the shared overlay panel, whose `close`
output is also emitted for a backdrop click, so separating keyboard dismissal from pointer dismissal
is its own change.

**The contract says focus returns *into the widget*, not to a named part.** Both renderers put a
dismissed daterange back in its start field rather than on the toggle that opened it, which is a
defensible design; landing on the document body never is. `state` is left unconstrained after this
gesture for the same reason — whether opening a picker and abandoning it counts as having touched the
field decides when validation errors appear, the renderers disagree uniformly rather than by
accident, and that is a product decision this contract does not get to make by recording whichever
renderer was measured first.
