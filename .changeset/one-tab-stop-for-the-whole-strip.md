---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

The chips strip is one tab stop, and the keys that work inside it are declared

Every chip was a tab stop and so was every control on it: **six presses to pass the field with two
values chosen, twenty-six with twelve.** What a control holds must not decide how long it takes to
leave it.

The strip is one stop with a roving index now, and the keys that move within it are in
`MDY_WIDGET_KEYBOARD` rather than at three call sites — which is where a reader will look for them,
and where the next renderer will find them without being told:

```
ArrowLeft / ArrowRight    move focus between chips        when closed
Home / End                to the first or the last        when closed
Alt+ArrowLeft / -Right    move the chip itself
Backspace / Delete        take off the chip you are on    when closed
```

`when: "closed"` on all but the reorder pair, because while the popup is showing the arrows belong to
the list a person is choosing from — the same key in two places is what the phase exists to separate.

`MdyKeyBinding` gains `remove` as an intent and `toEnd` beside `by`. Both directions come from the
binding rather than from the key, because a horizontal strip runs in the writing direction: in a
right-to-left document `ArrowLeft` moves *later*, and a renderer reading the key would have to know
that.

A chip's own controls — the remove, and the two steppers in counter mode — leave the tab order with
it. They are reached with the keys above.

**Each renderer had to stop the chip's keys bubbling.** The control's own handler answers several of
the same keys, so `End` moved focus and then had the popup's answer applied over it, and `Backspace`
removed nothing because the second handler won. The chip's keys are the chip's.

Verified in all three: 3 presses to reach the next field whether two values are chosen or twelve, and
`ArrowRight · End · Home · Backspace` answering identically.
