---
"@modyra/vue": minor
---

A chip can be moved with one press, and the strip shows it

Reordering had no single-pointer path in this renderer. The handles had been drawn once and removed
again, because they could not act: `move` resolves against the active chip, which only the keyboard's
roving focus sets, and the renderers that draw handles drive them by dragging. WCAG 2.5.7 asks for a
path that does not depend on dragging or on the keyboard — somebody who cannot hold and drag has no
other way — so a press now moves a chip one place, through the same doors the other renderers use.

`reorderable` is a prop, because the handle is owed to a field that offers reordering and this
component had no way to be told: the contract gates `chipMove` on the capability, and a handle drawn
against a rule the renderer cannot read is a control claiming an act it cannot perform.

**And the move was invisible, which the move unit found rather than assumed.** The chips were drawn
in the order the *option list* happened to be in, not the order the value holds them, so reordering
changed the value and left the strip looking exactly as before. For anyone who cannot read the model
that is a move that did not happen. The strip now follows `chosenKeyOrder`, and all three renderers
that draw handles agree on both halves: value `a, c, b` and strip `a, c, b`.

The custodian presses the **last** chip, because the first cannot move earlier and a press there
cannot tell "moved" from "clamped"; its second half asserts that a field which never offered
reordering draws no handle, without which a renderer that always drew them would pass.

Classified minor: an added optional prop is additive and no existing call breaks. The type-surface
audit reports major because the component's whole inferred props type is re-printed and it compares
by name — the case it documents as caution rather than evidence, adjudicated as minor before.
