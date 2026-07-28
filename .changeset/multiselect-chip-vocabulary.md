---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/core": minor
"@modyra/styles": minor
---

One chip vocabulary for the multiselect, so every renderer draws Angular's chip

The multiselect contract now names the chip anatomy the Angular renderer established — `mdy-chip`
with `mdy-chip__check`, `mdy-chip__label`, and, in counter mode, `mdy-chip__btn` and
`mdy-chip__count` — as the `option`, `optionCheck`, `optionLabel`, `optionStep` and `optionCount`
parts. The controller projects `mdy-chip--centered` or `mdy-chip--counter` per mode and
`mdy-chip--selected` per option, so an option looks the same whichever framework rendered it.
Plain renders that anatomy; the theme draws the tick for renderers that ship no icon set.

The chips a closed trigger shows now carry `mdy-chip--value`, which distinguishes a readout of the
current selection from an option a user can pick.

`MdyDynamicOptionsField` gains `mode: "single" | "multi"`, so a multiselect whose options can be
taken several times is expressible in a form config rather than only through a renderer argument.
