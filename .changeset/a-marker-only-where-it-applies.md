---
"@modyra/plain": patch
"@modyra/widgets": patch
---

A marker only where it applies, and one answer about being wrong

plain built the required marker into every label and hid it with `display: none`. Hidden is enough for
a person and for an accessible name, and not for anything asking *whether this field is marked* — a
test, a tool, a stylesheet — so an optional field carried the marker of a required one. It is added to
the label when the field is required and taken out when it is not.

**And the wrapper's paint disagreed with `aria-invalid`.** plain painted `mdy-input-wrapper--error`
from the verdict while the control said `aria-invalid="false"` from what was shown — the two faces of
one question, answering differently, which is the thing the comment above that line says must not
happen. Both read the shown verdict now.

**`keepKeyboardInPlay` also gains `afterBlur`**, and it is a correction to how it was first written:
a renderer that takes a control out of play calls *before*, with the keyboard still on it; one that
hears about it afterwards has only the fact that focus is nowhere. Treating "nowhere" as reason enough
in both cases moved the keyboard onto widgets nobody had been standing in. Two DOM checks were also
`instanceof Element`, which throws in a document whose implementation does not put `Element` on the
global — inside an effect, taking the rest of the render with it.
