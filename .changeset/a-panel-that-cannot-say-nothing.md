---
"@modyra/widgets": minor
---

The inspection panel, drawing a real widget

`drawReadings` takes readings and has no overload that takes a value. That signature is the whole
mechanism: a caller holding a bare value cannot reach the drawing layer without first saying where it
came from or why there is none. A layer that accepted both would depend on its authors choosing the
right call every time, which is the habit being replaced rather than a defence against it.

The lab's contracts panel now draws one, from the widget on the page: the control's id and where it
was read, the name it would be announced by and which of the four mechanisms produced it, and two
parts with their presence verdicts. One row deliberately probes a part the renderer does not draw, so
a reading with nothing in it sits beside readings that have something — which is the claim ADR 0188
makes, visible in one table rather than in two runs.

**The panel found its own first defect while being mounted.** The probe for `control` built a
selector from the part's classes, and `control` has none — so it matched nothing, and the table said
`(not read) — absent-probe: control answered nothing` instead of showing a blank. A panel that drew
bare values would have shown an empty cell and been believed.
