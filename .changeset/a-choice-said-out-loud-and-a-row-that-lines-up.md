---
"@modyra/widgets": minor
"@modyra/styles": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A choice is said out loud, and a multiselect is as tall as the controls beside it

**A choice landed and nobody was told.** The chips strip is the confirmation that something was
chosen, and it is the one a person using a screen reader does not get. The multiselect gains an
`announcement` part — a live region carrying the whole selection, not the last change, because two
announcements have to differ for the second to be read at all: a region written once announces the
first choice and swallows every one after it. The words come from the contract, so all three
renderers say the same thing.

**A multiselect was taller than the controls beside it**, and only in one theme. Every other control
takes the field height as a floor and holds a line of text, so the floor is also its ceiling; a
multiselect holds chips and had a floor alone, so a row that read 38px for a text field read 54 for a
multiselect and 62 once it held twelve. `max-height` gives it the ceiling its siblings get for free.

The eight pixels between two chips and twelve were the horizontal scrollbar: it is laid out *inside*
the strip and adds its thickness to the height, so the control grew by the width of a scrollbar the
moment its chips overflowed. The bar is not drawn now — chips visibly running past the edge is the
affordance, and it was never the only one.

Verified against all five stylesheets rather than the default alone: `modyra`, `modern`, `material`,
`ios` and `ionic` each give every kind one row height, and a multiselect holding twelve chips is the
same height as one holding none.
