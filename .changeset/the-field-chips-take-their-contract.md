---
"@modyra/plain": patch
---

A disabled multiselect leaves no operable chips behind

The multiselect renders its options twice — once in the field, once in the popup — and only the
popup's grid applied the contract part. The reason was sound as far as it went: the part carries an
`id` and a `hidden` flag, and only one of the two grids can own the id while only the popup filters.

Taking nothing at all for the field grid was too blunt. Everything else the part says is true of
both chips, so a disabled multiselect left two live buttons in the field: no `disabled`, no
`aria-disabled`, still clickable. The field grid now applies the part with the id and the filtering
dropped.
