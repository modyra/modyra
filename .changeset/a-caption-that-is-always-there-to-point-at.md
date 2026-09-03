---
"@modyra/angular": minor
---

Draw the caption element even when a document writes none

Everything inside a field is named by pointing at one element. A panel's `aria-labelledby` resolves
there, and a reference that lands on nothing does not fall back — it produces an empty name and the
`aria-label` beside it is never consulted.

Angular drew that element only when a caption was written, so on a field named by `ariaLabel` alone
there was nothing to point at. The projections name it unconditionally, and each renderer's template
carried a conditional that quietly stood in for the absence — a patch in the place nobody would look
for one.

The caption is now drawn whenever the field has words at all, carrying whatever the name resolver
chose, and taken out of sight through `mdy-label--unwritten` where those words are the field's own
key rather than a person's. That is the same element, the same class and the same stylesheet rule the
other renderers have used all along: parity in the mechanism, not a third answer to one question.

**The live defect this repairs.** On a caption-less form the timepicker's dialog pointed
`aria-labelledby` at an id no element carried, so it announced its role and nothing else. It now
announces the field's name. `renderers/a-name-that-points-at-nothing.spec.ts` mounts all eighteen
fields with no caption and asserts, for every named element, that the name a reader computes is not
empty and that no reference dangles.

**What changes for someone listening.** Every Angular field gains a programmatically available
caption; controls and panels that reference it now announce a name where some announced only a role.

**What changes on screen.** Nothing. The caption is hidden by the rule already in the shared
stylesheet — absolutely positioned, clipped, out of flow — so it occupies no space.

Three kinds still draw no shared caption: the control names itself where the caption would sit inside
it. That is each kind's own decision and this change does not take it for them.
