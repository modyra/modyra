---
"@modyra/widgets": minor
"@modyra/vue": patch
---

The stepper on a chip is a part, and every renderer draws the same ones

Two renderers drew a quantity stepper on a value chip carrying `mdy-chip__btn` — the class the
contract declares for a stepper on an entry in the **list** — and a third drew none at all. Three
renderers disagreeing about an element because nothing named it, which is the third time this shape
has surfaced: the words in a chip, the count beside them, and now the control that changes it.

`chipStep` is declared beside `chipMove` and `chipRemove`, present exactly when a chip is. **It takes
the class those two renderers were already emitting**, so nothing migrates and nothing moves on
screen — the borrowing ends because the element is now named, not because it was repainted.

Vue adopts the declared parts. Its chip drew a single fused "Move" where `chipMove` is declared
repeated — one handle for two directions, offering a pointer no way to say *which way*, with the
words for both sitting unread in the message table. It now draws one per direction, where there is
more than one value to order, and both steppers in counter mode. The names come from that table
rather than from three more English literals in a template.

**A filled multiselect owes the control that takes a value back off.** Extending the rule that a
filled field owes its chips: a chip a person can put in and not take out is the same shape as one
that submits invisibly. `chipStep` and `chipMove` stay unowed — the first exists only in counter
mode, the second only where there is an order to change — so neither is owed by a filled field as
such. Falsified: with the remove control deleted under a clean build, the canonical observation
reports `missing part: chipRemove`.
