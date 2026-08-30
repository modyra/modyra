---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The keyboard shortcut a record promised now exists

ADR 0147 states that `Ctrl`/`Cmd`+Z reaches a multiselect's undo. It reached nothing, from any
position focus could hold, in any renderer — and a shortcut that does nothing cannot be told apart
from one nobody pressed, so a record read by people who tell their own users was worse than a record
that had never promised it.

The gesture is now **declared in the keyboard contract** rather than written into three renderers:
`MdyKeyBinding` gains `modifier: "primary"` for the platform's own accelerator, and
`matchesKeyGesture` resolves a binding against an event so the platform test is made once.

**Migration.** `MdyKeyBinding["intent"]` gains `"undo"` and `MdyWidgetKeyIntent` gains `{ type:
"undo" }`. A consumer that switches exhaustively over either has one more case to answer; anything
reading them non-exhaustively is unaffected.

Using the way back also left focus on nothing, because the offer is withdrawn by using it and took
the person's place with it — so undoing a removal cost finding the field again, which is the cost the
undo exists to save. The reading position now lands on the value that came back, or on the field when
there is none.
