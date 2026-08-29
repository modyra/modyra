---
"@modyra/lit": patch
"@modyra/plain": patch
---

The colour field's native input leaves the accessibility tree instead of being named in it

A regression, and its repair is smaller than the thing it repairs. Removing a hardcoded English
fallback left the hidden native colour input with no accessible name, which an auditor calls critical
— it reads the element because it is in the tree, not because it is visible.

The first answer was to name it again. The contract says not to: **the caption points `for` at the
hex input, the swatch points `aria-controls` at the popup, and nothing points at the native input at
all.** It is the platform's chooser, opened by the swatch, and a person operates that. Named, it puts
a second colour control in the tree that nothing described; hidden, it is the machinery it is, and it
is not tabbable so hiding it strands nobody.

Three renderers had answered that silence three ways — one hid it, two gave it different English
names — and an auditor was green on the first and critical on the others. That is the whole argument
compressed: a control in the tree that nothing describes is a control a reader meets and cannot place.

**Five more parts are in the same state, and they are not machinery.** The search boxes inside the
select and multiselect panels, the second date box of a range, and the two spinners of a timepicker
all render controls no relation names, so what a person hears at each is every renderer's own
decision. Recorded rather than asserted away: the list can only get shorter, each entry says whether
it is machinery or a gap in the contract, and an entry that stops being true fails the check as loudly
as a new one appearing.
