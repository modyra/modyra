---
"@modyra/widgets": major
"@modyra/angular": patch
---

A widget's own box is a part, and the parts it lays out are declared as its children.

`MDY_WIDGET_CONTRACTS` named `inputWrapper` — the shell every kind sits in — as the parent of parts
that every renderer draws one level deeper, inside the widget's own layout box. Nine parents move to
where all three renderers already build them:

- multiselect: `chips`, `trigger`, `overflowCount`, `clearAll`, `announcement` → `box`
- file: `fileList`, `clear`, `rejected` → `content`
- slider: `value` → `track`

The rule underneath, and why the two boxes must not be merged: **one part name means one element.** A
name shared by two elements makes every measurement taken through it ambiguous — which is how a height
comparison came to be off by the border a theme draws on one of them.

`trailingAffordances` now looks for a kind's affordances in the widget's own box as well as in the
shell, or the multiselect's clear-all and overflow stop being affordances the moment they are declared
where they are drawn.

`@modyra/angular`: the select's arrow moves inside its opener, matching the other two renderers, and
the multiselect's chip tooltip is drawn after the announcement rather than before it — the position
the other two use and the one the contract now states.

See ADR 0143.
