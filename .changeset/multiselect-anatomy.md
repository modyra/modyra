---
"@modyra/widgets": minor
"@modyra/plain": patch
---

The multiselect's popup is one anatomy, not one per renderer

Angular's multiselect draws a header holding the filter, a grid of option chips, each chip in its own
wrapper, and marks a taken option with a modifier. None of that was named, so another renderer could
only produce a list that happened to hold the same words. The catalog now names `popupHeader` and
`optionWrapper`, the listbox carries the grid class every adapter must emit, and the chips carry
their state as modifiers — `mdy-chip--selected`, with `--counter` or `--centered` for the mode —
which is what a theme styles.

The framework-free renderer draws that anatomy: the filter in the header, each option chip in its
wrapper inside the grid, and the selected modifier on a chip in either mode.
