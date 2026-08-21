---
"@modyra/widgets": minor
"@modyra/core": minor
"@modyra/styles": patch
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A dial that shows which of its stretches carry nothing

A face declared with `minuteStep: 15` draws four numbers and the other 356° of the ring look exactly
like them — continuous, uniform, and offering nothing. The granularity is real and invisible, and the
only way to find it is to try.

`showUnavailable` — on the field in a document, an input on Angular, a property on Lit — dims the
stretches the granularity took away. **Off by default**, so a face that declares nothing is unchanged.
Named for what it shows rather than for how it looks, because a theme may express it as an arc, an
opacity, or something else.

`MDY_WIDGET_CONTRACT_VERSION` moves to **5**: a timepicker's dial gains `dialUnavailable` and
`dialUnavailableArc`, which sit between the face and the hand — so a renderer built against 4 draws
them nowhere. The plain and lit contract audits were re-read against the change rather than having
their pins widened, and neither asks about parts, so both pass unchanged.

Each ring answers for its own radius: the inner one is drawn on a smaller circle, so a same-sized
digit covers more of it and its dead stretches are wider. A single set of arcs drawn for both would
be wrong on one of them.

The Angular demo gains three cases — a quarter-hour face with its dead slices shown, a three-hour
face where both rings have their own, and one with the hand animated. Those are the cases no
automated tier can ask about: no host renders Angular in a browser, and a drag under real pointer
capture is not something jsdom produces.
