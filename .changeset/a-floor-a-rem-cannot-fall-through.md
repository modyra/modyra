---
"@modyra/styles": patch
---

A target keeps its floor when the page shrinks the root.

A `rem` grows with a reader who enlarges their text — and **shrinks with an application that writes
`html { font-size: 62.5% }`**, the ten-pixel trick, still common. Nothing here controls that
declaration and nothing can see it.

Measured at three roots, identically in all three renderers:

```
62.5%   chip 202×18 · its buttons 32×16 · clear-all 18×35     under the 24×24 floor
100%    none
200%    none
```

**200% is the direction everyone tests, and a target can only grow there.** 62.5% is the only one where
it falls through, and it was the one nobody ran.

The control steps and the affordance sizes are `max(<proportional step>, <floor>)` now: the step still
rises with the reader, and it cannot fall through a conformance floor on the way down. The scale's own
comment already said *"the floor is not a style choice"* — the value did not carry it.

`px` for strokes and the focus ring stay `px`, for the reasons already recorded.
