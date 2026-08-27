---
"@modyra/core": minor
"@modyra/plain": minor
"@modyra/angular": minor
---

The nesting limit holds at the door a document never passes through

A layout may hold sections inside sections, and `MDY_LAYOUT_MAX_DEPTH` has capped that at six since
nesting arrived. The cap was applied by the document reader and by nothing else, so a structure
assembled in code nested as deep as it liked and mounted in silence — and the same form was legal or
not depending on how it had been written down.

`assertLayoutWithinDepth` is now exported and applied wherever a layout arrives already built:
`mountMdyForm` in `@modyra/plain`, and the `layout` input of Angular's dynamic form. It throws,
naming the depth, the path at which the structure passed the limit, and the reason — there is no
document to annotate and no partial result worth returning.

**Migration.** A call passing a layout deeper than six rendered a form before and raises now. Nothing
else changes: a document is still read the way documents are read, keeping what it can carry and
reporting what it dropped.

The limit is about what a person can be asked to answer rather than what a browser can draw — nesting
costs the machine nothing measurable, which is exactly why the reason had to be written down. ADR 0160
records it, along with what raising it would take, since the obvious question about any limit is
whether it can be lifted.
