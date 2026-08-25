---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/styles": patch
---

The chip strip is a `grid` and every chip a `gridcell`.

A screen reader switches between its two modes on the role of the focused element, and `listitem` —
which the chip was — is not one it switches on. Somebody who arrived at the field **by browsing** — by
heading, by landmark, by jumping to the next form field, which is the ordinary way to arrive — pressed
an arrow, the virtual cursor moved, focus stayed on the chip, and the strip's entire keyboard model
never reached them. Silently, and only on one of the two ways in.

`gridcell` is a role the mode switches on, and it may contain buttons, which is what a chip is: a thing
with up to five buttons in it. `option` switches too and is refused for its own reason — this widget's
listbox is the popup a person chooses from, and a strip of what was already chosen is not a second one.

**Always, not only where a chip holds a quantity.** ADR 0148 supersedes ADR 0138, whose objection was
against a grid that arrived *with* the quantity: a strip that changed role with its contents would
change its keyboard model underneath the person who filled it.

**Migration.** A consumer styling or querying `[role="list"]` / `[role="listitem"]` on the chip strip
should read `grid` / `gridcell`. The classes are unchanged.

**The position moves with it.** A `gridcell` does not take `aria-posinset`/`aria-setsize`; a grid says
the same thing with `aria-colcount` on the strip and `aria-colindex` on each chip, which exist for a
set that is not all rendered — the same shape as a row that scrolls. A reader announces "Roma, column 3
of 12". One cell per chip, never one per button: the index counts cells, so five buttons each a cell
would say "column 14 of 72".

**The strip appears with the first value and goes with the last.** An empty grid announces contents it
does not have, so a field nobody has chosen anything in draws no grid at all — what says it is empty is
the placeholder. `chips` is therefore optional in the contract rather than required.

**Removing the last value says so**: `selectionRemovedLast`, new in the message catalogue in five
locales, because once the strip is gone nothing else in the page tells a person what happened.
