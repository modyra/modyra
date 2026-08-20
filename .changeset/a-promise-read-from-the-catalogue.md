---
"@modyra/lit": patch
---

An opener promises what the catalogue says it opens

`aria-haspopup` is announced with the control — "combobox, has popup listbox" — so a person decides
whether to open the thing from what they were told it is, before anything has opened. The words are
not interchangeable: a listbox is options with a selected state, a grid is walked with the arrow
keys, a dialog is somewhere to go and come back from.

Seven openers wrote their own literal. One of them had drifted: the date picker promised a dialog
where the catalogue and the other renderer say `grid`, so the same widget told a screen-reader user
two different things depending on which renderer drew it. Colours promised a dialog on one of its two
openers and a listbox on the other, for one popup.

Every opener now reads the promise from `MDY_POPUP_OPENERS`, so a kind has one answer and a value
that changes there reaches the page.
