---
"@modyra/angular": patch
---

`aria-describedby` names an error list that exists

Thirteen renderers pointed `aria-describedby` at the error list whenever the field had errors, and
rendered that list under a different condition — only once the field had been touched, and only when
inline errors were off. The two predicates disagreed on both axes.

So an invalid but **untouched** field described itself by an element that was not in the document.
That is not an edge case: it is the resting state of every required field on page load. A field using
inline errors dangled even after being touched. A screen reader following the reference found
nothing.

The text kinds had the inverse defect and so never showed up as dangling: their fallback tested
`inlineErrors &&` — the inverse of the render condition — so in the ordinary case they emitted no
`aria-describedby` at all, and announced their errors to nobody.

One predicate on the base control, `describedById`, now answers both questions: it returns the id
the error-list component actually renders, and `null` when no list is there to name. Angular's
supporting text carries no id, so a control with no errors describes itself by nothing rather than
by an id nobody rendered.
