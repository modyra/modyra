---
"@modyra/plain": patch
---

The framework-free range picker stops deciding what a range means

`createDaterangeFieldController` has existed since the controllers batch and no
renderer consumed it. The framework-free one now does: which pick starts a range
and which closes it, what the bounds refuse, and which cells fall between the
ends are its answers.

Two of those were wrong here. The cells were painted by comparing ISO strings —
a fourth opinion on a question three other places already answered — and they
were drawn from the committed value, so the highlight could not follow the
pointer before anything was decided. The controller paints from `previewed`,
which is what that distinction exists for.

Typing a range and clicking one now commit through the same two intents, so they
cannot diverge.
