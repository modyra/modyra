---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

The order of what was chosen can be changed, and by a keyboard first

A multiselect's value has kept arrival order all along, and nothing could change it: reordering meant
removing and re-adding, which can put a value last and nowhere else — and only from the option list,
rather than from the chip in front of the person.

`move-selected` is the one intent that moves a chosen value, so the keyboard and a drag are two doors
onto the same thing rather than two mechanisms that can disagree about what an order is. It moves the
*distinct* values in the order the strip draws them, and a value taken three times moves as one thing,
because the chip a person is dragging is the quantity. `to` is clamped rather than refused: a control
asking for one past either end means "as far as it goes", which is what holding an arrow down does.

`MDY_WIDGET_KEYBOARD` gains `Alt+ArrowLeft` and `Alt+ArrowRight` at `intent: "reorder"`, declared for
any kind whose anatomy holds a `chips` part. `Alt` because the bare arrows already belong to wherever
focus is — a strip is scrolled with them, a list is walked with them — and a key that means two things
depending on where you are is a key nobody trusts.

A binding carries `by: -1 | 1` rather than leaving a renderer to read the key, because *earlier* is not
*left*: the strip runs in the writing direction, so in a right-to-left document `ArrowLeft` moves a
chip later. A renderer reading the key would have to know that; reading the direction, it does not.

`MdyDynamicOptionsField.reorderable` decides whether any of it is offered, and it is **off by
default** — most lists have an order nobody chose, and a set of filters has nothing to rearrange.

Angular's dynamic form now forwards `searchable` and `reorderable`: it forwarded neither, so both were
capabilities a document could declare and that renderer alone could not reach.
