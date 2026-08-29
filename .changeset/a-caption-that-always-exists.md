---
"@modyra/lit": patch
---

The caption element always exists, so every reference to it resolves

Two panels were announced as "dialog" and nothing more. Everything inside a field is named by pointing
at the caption — a dialog, a listbox, a grid all carry `aria-labelledby` at it — and this renderer drew
that element only when a document wrote one. So on a caption-less document every reference dangled,
exactly when the fallback was supposed to be carrying the field.

A reference that lands on nothing is worse than no reference: a reader is told a name exists and then
hears the role.

The element is drawn always now, carrying what the name resolver chooses, and taken out of sight where
those words are the field's own key rather than a person's — visually hidden rather than removed,
because `display: none` would take it out of the tree along with every reference to it, which is the
defect rather than a stricter form of it.

Restoring it to caption-only turns three checks red, two of them the panels above. ADR 0170 records
the decision, the third renderer's shape it adopts, and the part it does not fix: a raw key announced
as "rows dot zero dot code" is a poor name that beats no name, and humanising it is additive work
named there rather than done here.
