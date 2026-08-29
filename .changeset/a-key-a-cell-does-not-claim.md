---
"@modyra/lit": patch
---

A calendar cell claims only the keys it declares

Lit's calendar prevented the default for **every** key while the day view was open, so `+`, `-`, a
digit, a letter, `Backspace` and `Delete` were all taken on a cell — none declared and none answered.
A key that is prevented and unanswered is worse than one nothing claims: the platform's own meaning
is gone too.

It asks the catalogue now — the cell's own declaration first, the control's after it, because a
binding with no part is what a kind answers wherever nothing more specific does. Measured on a cell:
`ArrowRight`, `Escape` and `Space` are claimed, and everything else reaches the browser.
