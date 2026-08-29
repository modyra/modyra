---
"@modyra/plain": patch
"@modyra/lit": patch
---

A state attribute says what the contract says, in both directions

Three renderers narrowed or widened what the projections declare, so the same field said different
things depending on who drew it.

Plain wrote `aria-readonly="false"` on a colour field and on both ends of a range. The projection
emits that attribute only while it is true — "false" is a claim about a state the control is not in —
so Plain now writes it or nothing.

Lit dropped `aria-disabled` from a select's trigger when it was false, where the contract declares it
in both states: a trigger that is not a native control says "no" rather than saying nothing.
