---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
"@modyra/styles": minor
---

The trailing column carries one thing

A multiselect's trailing edge held three affordances side by side while every other kind held one,
and after the previous release both of the extra two were permanent. The reading order is now
`chips`, `overflowCount`, `wayBackAction`, `clearAll`, `trigger`, `arrow`: the commands about the
value stand with the value, and the column at the field's edge carries only the control that opens
it — which is what lets a person operate a form without reading it, and what someone at 400%
magnification uses to tell they are still in the same form.

Breaking: the contract's part order changed, so keyboard order changed with it — Tab reaches the way
back and the clear-all before the control that opens the list. A consumer asserting the old order,
or styling by position rather than by class, has to follow.

A button whose whole visible content is a mark (`×`, `↶`) now hides that mark from the accessibility
tree and carries a `title` with the same words as its accessible name, so a reader does not announce
"multiplication sign" before the name and somebody driving by voice has a word to say.

Fixed: a lit `file` field holding a value that is not a `File` — a restored draft, a server's answer
— threw on its first paint instead of drawing a row without a caption.
