---
"@modyra/styles": patch
"@modyra/lit": patch
---

Three things a field draws, corrected.

**One name, one element.** `@modyra/lit`'s colours and daterange fields each rendered their own
`.mdy-input-wrapper` inside the one the base already draws — two elements answering to `inputWrapper`,
one inside the other. A selector returns the outer, a measurement may take either, and a reading
cannot say which it meant; it is the ambiguity ADR 0143 forbids, and the height comparison that
record was written from was made of it. Both kinds now decline the base's wrapper through the
mechanism that already exists for it, and draw their own affixes as they already did.

**An affordance a kind removed and did not give back.** The foundation takes the platform's arrow off
every native chooser so a form of them looks like one form. `@modyra/lit`'s native select drew neither
that one nor its own, so the field had nothing at its trailing edge saying it opens — while four other
kinds in the same renderer draw theirs.

**The caret sits where the column is.** A multiselect's arrow was packed at the start of the opener,
so it stood wherever the chips left off — a different distance from the field's edge on every value,
and a different one again from the clear-all beside it. At the opener's trailing edge now, which is
what `DESIGN.md` asks of a trailing affordance: one column, whatever the field holds.
