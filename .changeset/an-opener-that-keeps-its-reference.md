---
"@modyra/lit": patch
---

An opener names its overlay in both states

`aria-controls` is a property of an opener whether or not the popup is showing — one that drops it
while closed reads as a control with no overlay at all — and lit dropped it, because its panel leaves
the DOM when it closes and a reference resolving to nothing is worse than none.

The container now outlives the content: closed, the panel is an empty element carrying the id the
opener names, which is what the other renderers leave behind too. Nothing of the overlay is rendered
inside it, so a closed widget still announces no cells, options or dial.
