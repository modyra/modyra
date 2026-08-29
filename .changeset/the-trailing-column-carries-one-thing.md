---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
"@modyra/styles": minor
---

A mark is not a label, and a command does not travel with the value

A button whose whole visible content is a mark (`×`, `↶`) now hides that mark from the accessibility
tree and carries a `title` with the same words as its accessible name. A reader announced
"multiplication sign" before the name; somebody driving by voice had nothing to say, because a glyph
is not a word. The name itself is unchanged: the criterion about visible text in the accessible name
is written for text a person reads as a word, so it does not bite on a mark.

A multiselect's way back and clear-all keep their place at the field's trailing edge, with the mark
that opens the field outermost and a full target of empty space between the two commands. Standing
them beside the chips they act on was tried and measured: the chip strip's width is the length of the
value, so both slid about 90px whenever a value arrived or left — putting the control that discards
the field where the control that restores a value had just been, under the hand reaching for it. A
control's position may depend on the field; never on the value.

The `file` field's clear moves for the same reason: below the list of chosen files its position was
the number of files, so it slid every time one was added or removed — under the hand of somebody
taking several off one at a time. It stands with the control that picks files now, and the contract's
reading order for `file` follows: `content`, `clear`, `fileList`, `fileItem`, `rejected`.

Fixed: a lit `file` field holding a value that is not a `File` — a restored draft, a server's answer
— threw on its first paint instead of drawing a row without a caption.
