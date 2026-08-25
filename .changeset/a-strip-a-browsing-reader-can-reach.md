---
"@modyra/widgets": major
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

**Open, and recorded rather than hidden:** `gridcell` does not carry `aria-posinset`/`aria-setsize`,
which is what ADR 0137 pays the scrolling strip with. That conflict is with the accessibility
specialist and this record will be amended or superseded by the answer.
