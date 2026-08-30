---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/styles": patch
---

The way back joins the field's trailing edge, and the caret is drawn last

A multiselect's undo moves from a row beneath the field into the row of commands at the field's
trailing edge, where the clear-all it reverses already sits. The row goes, and the band it reserved
returns to the validation message.

**Migration.** The `wayBack` part no longer exists and `wayBackAction` is now a child of `box` rather
than of that row; `arrow` is a child of `box` rather than of `trigger`. Anything selecting
`.mdy-multiselect__way-back` or reaching a part through those parents follows the new structure. The
`mdy-multiselect__way-back-action` class stays and is now a mark rather than a word — it names what
it puts back through its accessible name, composed by the new `wayBackActionName`.

The count of what is chosen no longer appears under the field. The chips are the selection, and the
ones the strip scrolled past are counted at the strip's own edge, where the count is also the way to
reach them.

**A defect closed with it**: that edge count answered `1` for every arrangement — it measured the row
holding the chips instead of the chips, so a strip hiding twenty-five said "1 more not shown". It now
counts chips at any depth. Renderers no longer write a count of zero into a control they are not
showing.
