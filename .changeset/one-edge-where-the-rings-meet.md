---
"@modyra/widgets": patch
---

One edge where the two rings meet

Which ring a press on a 24-hour face claims went through three rules, and the two that failed each
fixed the other's defect.

Everything inside the midpoint being `inner` meant a press aimed at the outer ring answered with an
inner hour — most of a dial is empty middle. A symmetric band around the inner radius fixed that and
introduced the opposite: the centre answered `outer`, so a pointer moving inward crossed
outer → inner → outer and the hand snapped to the far ring exactly where its numbers are furthest
away.

It is one edge now, above the inner radius only, at `MDY_TIMEPICKER_RING_BAND` of the gap between the
two painted radii — `0.35`, so the edge sits at 74 against digits drawn at 60 and 100. The centre and
the inner digits answer inner; a press just inside the outer digit answers outer.

One-sided on purpose, and it will look asymmetric: below the inner ring there is no other ring to
belong to. Everything beneath the inner digits is nearer them than anything else on the face.

ADR 0120 records the model and carries this as an amendment, including why the obvious geometric
construction cannot decide the edge: the two digit boxes touch, so the midpoint of the gap between
them is the edge itself whatever the box size.
