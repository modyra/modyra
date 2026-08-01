---
"@modyra/widgets": minor
"@modyra/plain": patch
---

Milestone B, batch 4: a landmark must be announced with a name.

Dimension 2's remaining half. `element` already said what a part *is* and the relations said what it
points at; nothing said how a screen reader is supposed to announce it. A listbox, a grid or a dialog
with no accessible name is read as an unlabelled container and the user has to guess what they have
landed in.

Declared as a rule rather than a table per kind, because the requirement comes from what the element
is rather than which widget it appears on. Which mechanism supplies the name — `aria-label`, a
resolved `aria-labelledby`, a `label[for]`, a wrapping label, or the element's own text — stays the
renderer's choice, and so does the text, which the renderer has to translate.

`colors.presets` is corrected from `group` to `listbox`. All three renderers emit `role="listbox"`
over `role="option"` swatches, so calling it an unconstrained group let the contract have no opinion
about something every renderer had already agreed on. With the semantic right, the rule applies — and
found that Plain's palette carried no name where Lit's and Angular's both do.
