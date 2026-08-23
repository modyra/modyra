---
"@modyra/styles": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The multiselect's way back reserves its line, so removing a value moves nothing else.

The row that offers the undo was rendered only while the offer stood, so every control below the
field stepped down 21px when a value was removed and stepped again on the next removal. The row is
now always in the page and always one line tall; its sentence and its button are what come and go.
At rest there is nothing to read, nothing to announce and nothing to press.

The offer is deliberately not moved into the control's box: it would trade the vertical shift for a
horizontal one, with the clear-all and the caret sliding as it arrived. ADR 0144 records both.

Angular's row also moves ahead of its overlay panel, which the contract's part order requires and
which nothing could observe while the row was conditional.
