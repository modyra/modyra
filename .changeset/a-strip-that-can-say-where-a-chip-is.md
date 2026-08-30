---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/styles": patch
---

A chip strip that can say where a chip is

`aria-posinset` and `aria-setsize` are legal on `option`, `listitem`, `row`, `tab`, `treeitem`,
`radio`, `menuitem*`, `article` and `comment`. The strip was a `group` and a chip was a `group` — or a
`spinbutton` when it held a quantity — so the position and the count every chip states were written to
the DOM and permitted on neither role. ADR 0127 departed from 1.4.10 and paid for it with exactly
those two attributes; the payment could not be made in the roles the strip had.

The strip is now a `list` and a chip a `listitem`, in the catalogue, so all three renderers say it
once. `option` would also take them but only inside a `listbox`, and the listbox here is the popup a
person chooses from — a strip of what was already chosen is not a second one. A counter chip stops
claiming `spinbutton`: a control cannot be both the item at position 3 of 12 and the number 3 of a
range, and the role that carries the position is the one the strip owes. Its quantity is in the chip's
own name and in the announcement its change makes, so `aria-valuenow`, `aria-valuemin` and
`aria-valuetext` are gone from it.

The row also wraps at 320 CSS pixels — 400% zoom on a desktop viewport — where a single scrolling row
stops being a layout and starts being content a person has to operate blind.

Migration: a consumer styling `[role="group"]` inside the strip, or reading a chip as a spinbutton,
reads a `listitem` in a `list` instead. The classes are unchanged.
