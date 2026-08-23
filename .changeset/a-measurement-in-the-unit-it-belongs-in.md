---
"@modyra/styles": patch
---

Thirty-one declarations move onto the scale, most of them the timepicker's.

A length written in `px` stays where it is while everything around it grows for a reader who enlarges
their text, and a length written as a literal is a value nothing else in the library shares. These are
now steps where a step is exact — `gap: 16px` is `--mdy-space-4`, a 20px glyph is `--mdy-size-5` — and
`rem` where none is.

Three are judgement rather than arithmetic:

- **A date control's right-hand clearance** was `40px` and is now the affordance column's own
  arithmetic, `calc(box + inset * 2)`. Four pixels tighter, and it follows the column instead of
  sitting near it.
- **The timepicker's mode toggle** was 32×32. It is a control inside a dialog, so it takes the step
  every other in-field affordance takes.
- **The hour and minute numerals** are 45px, which is no step and should not be forced into one: a
  numeral read across a room is not a word read in a line. The size scale gains a display step at
  Material's display-medium, exact at the same 45px.

`em` is converted along with `px`, for the reason `DESIGN.md` gives for leading: it multiplies a size
the theme chose by a number the host chose, and only some of those products land on the pixel grid.
