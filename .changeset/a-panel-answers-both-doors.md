---
"@modyra/lit": patch
---

A multiselect opened with the pointer answers the keyboard

Opening the list with a press left focus where the pointer left it — on the field's box, which is not
focusable, so on nothing. A panel with nothing focused answers no key: the arrows did not move and
Escape did not close, while the same list opened from the keyboard answered both.

The opener now takes the reading position before the list opens, on the pointer route as on the
keyboard one. Where that position lands stays each renderer's decision; answering from one door and
not the other does not. ADR 0156.
