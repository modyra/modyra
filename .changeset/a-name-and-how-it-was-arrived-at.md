---
"@modyra/widgets": minor
---

A name read with the mechanism that produced it

`readAccessibleName` resolves the name an element would be announced by, and says which of the four
mechanisms produced it — `aria-labelledby`, `aria-label`, a `<label>`, or the element's own text.

**Asking whether an element has a name is a different question from asking which**, and only the
second is order-sensitive. An implementation that consults the mechanisms in any order still answers
"yes, it has one" correctly — which is why the kit's own boolean helper can afford a different order
— and answers *which* wrongly the moment an element carries two. A panel reporting the losing
mechanism sends a reader to change the wrong attribute.

A `labelledby` that resolves to nothing is not a name: the reading falls through to what a reader
would actually hear, rather than describing a page nobody experiences.

The reading declares `method: "own-implementation"`. No browser exposes its own name computation to
a page, so this is a derivation and says so — a panel that borrowed authority it does not have would
be worse than one that abstained, because a reader would stop checking.
