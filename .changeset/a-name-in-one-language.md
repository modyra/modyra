---
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/vue": patch
---

A colour field's hex box is named in the document's language

Three renderers named that control by taking the field's caption and appending words of their own:
`"— hex value"` in Plain, `"(hex)"` in Lit, and in Vue the literal `"Hex colour"` where no caption
existed. Measured on a page in another language, the name a screen reader announced was
**"Colore del marchio — hex value"** — one name in two languages, with the half nobody could
translate, because it was a string in a template rather than a message in the dictionary.

It survived because it is inaudible to anyone working in English. The fault is only heard by the
person it fails.

Angular was already right: it asks `fieldAccessibleName`, so its name is the field's own words. Plain
now writes no name at all and lets its shell name the control — the shell already does exactly this
for every other kind, and its own comment names the hazard ("in English on a translated page"); the
colour field wrote first, so the shell's rule never ran. Lit drops the suffix. Vue's fallback, which
is the one place a name is genuinely owed from nowhere else, reads `colorHexLabel` — a message this
package has carried in five languages, with no reader, all along.

Measured after: the name is the caption, in one language, through one attribute. A bench pins it by
subtracting the caption from the resolved name and requiring nothing to remain — so appending a
different English word tomorrow fails too, which asserting "does not contain 'hex'" would not.
