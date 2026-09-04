---
"@modyra/widgets": minor
"@modyra/vue": patch
---

A field that leaves the scene closes what it holds open. ADR 0206.

An overlay closed two ways and there was a third nobody owned: a controller closes on an *intention*,
a component destroys at *end of life*, and a field taken out of the document by a rule the document
carries is neither — nothing is destroyed and no intention arrives, so an open panel stayed on a page
whose field was gone.

Three of the four renderers passed this without deciding anything, because they draw the panel inside
the field's subtree and whatever removes the field removes the panel too. ADR 0131 says in as many
words that where a renderer puts its popup **is not decided by this project** — so the contract was
resting a promise on a choice it had declared free, and the renderer that exercised the freedom lost
the promise. That is the promise never having been stated, not that renderer's defect.

`closeWhenFieldLeaves` states it. The keyboard is part of the same instant and travels with it: a
field that leaves takes its control, and a person standing there would otherwise be left on `<body>`
with their next Tab starting at the top of the page. ADR 0131 is untouched — a renderer may still put
its popup anywhere; the closing no longer depends on it.

`@modyra/vue`'s six panel kinds call it, since this is the package that draws its panels outside the
field.
