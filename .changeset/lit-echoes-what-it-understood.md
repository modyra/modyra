---
"@modyra/lit": patch
---

A date field echoes every spelling, not the first one

Typing `2026.03.04` or `2026/03/04` into a Lit date field left the keystrokes on screen, while
`2026-03-04` came back as "March 4, 2026". The field understood all three — the value it held was
right in every case — but only one of them was echoed.

The cause is not the echo being absent. A second spelling of a day the field already holds changes
no bound value, so nothing re-renders, and a binding that compares against its own last render
never rewrites the box. The first spelling worked only because it moved the value off empty.

The handler now writes the reading itself, which is what the other two renderers already did. What
the field could *not* read still stays on screen to be corrected: `entryText` survives exactly
those entries, so the echo is written only when it is null.
