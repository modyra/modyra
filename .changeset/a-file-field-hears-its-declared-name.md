---
"@modyra/plain": patch
---

A file field carries the name its document declared

The kind takes the shell's wrapper out and inserts its drop zone itself, so it never reaches the step
that names a control — and that step is where a declared name is applied. The name was handed to the
shell and landed on nothing. The field was not silent: its caption still named the input natively, so
it had *a* name, and the document's own was dropped without a trace.

That is what made it invisible. A check asking "is this control named" answers yes.

Lit, Vue and Angular all deliver the declared name here, so this was neither a limit of the kind nor
a position anybody had taken — measured across the four renderers rather than argued.

The name is applied only where a document declares one: with just a caption the input is already
named natively, and writing the same words again would be a second name saying the first one over.

The bench that pins it derives its roster from the anatomy — every kind whose `control` node is an
`input` or a `textarea` — instead of listing kinds by hand. Listed by hand it had `select`, which has
no `control` node at all, and was missing four kinds: the defect the bench exists to catch, in the
bench.
