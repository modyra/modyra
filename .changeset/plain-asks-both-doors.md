---
"@modyra/plain": patch
---

Five renderers ask the contract for their class names

`datepicker`, `timepicker`, `daterange`, `file` and `colors` take twenty class names from
`partClasses` and `presentationClass` instead of spelling them. Same strings on the element; one
place they are written instead of two.
