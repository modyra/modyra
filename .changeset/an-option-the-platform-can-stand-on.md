---
"@modyra/plain": patch
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/widgets": patch
---

An option the platform can stand on, and a caption a control is named by

**A select nobody could operate from the keyboard.** The entry for "nothing chosen" is disabled, and
with no option *declaring* itself selected the browser rests on index 0 — that entry — so arrowing
off an option that cannot be chosen is not a move it makes and the control answered no key at all.
Both renderers set the property, which a document already reports for index 0 whether anybody said
so; the attribute is the declaration, and it is what the working renderer had.

**A caption a control is named by.** Angular's datepicker wrote `aria-label` where the field has a
visible caption, replacing the words a person is reading with words only a reader hears. It reads
`fieldNameAttributes` now, like every other control.

**A datepicker named by nothing in lit.** Its input applied the shell part and hand-wrote the role,
the popup relation and the caption — four literals answering what the projection already says, and
the caption was not among them. It applies the projected trigger part now. `aria-controls` stays the
renderer's: the projection names the day grid, and choosing a month or a year replaces it, so a
fixed reference would name an element that has been taken away.
