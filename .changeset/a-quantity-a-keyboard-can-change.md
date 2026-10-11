---
"@modyra/vue": patch
---

A Vue number field carries its steppers, and a counter chip answers the keyboard

The number field now draws the increment and decrement buttons its contract declares, inside the
same spinner wrapper the other renderers use. A press steps by the field's own step and stops at its
bounds; the buttons are out of the tab order, named, and disabled with the field.

A multiselect chip now answers the keys the contract declares on it. `ArrowUp` and `ArrowDown` raise
and lower a counter chip's quantity, which is announced as it settles; the arrows along the strip,
`Home` and `End` walk the chips; `Backspace` and `Delete` remove one and leave focus on its
neighbour. These keys no longer reach the field, where `ArrowDown` opened the list. A key pressed on
a control inside the chip stays that control's.

No migration.
