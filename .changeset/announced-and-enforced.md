---
"@modyra/widgets": patch
---

A control the contract announces as disabled now carries the attribute that makes it so.

The shared field shell emitted `aria-disabled` and not `disabled`. The kinds that carry the native
one add it in their own projection, and the two that take the shell's control unchanged — `file` and
`colors` — carried the announcement without the refusal: **a control a screen reader was told could
not be used, that a pointer could still use**, changing a value the model refuses.

Found by driving the `disabled` state through the conformance kit, which reports it as
`STATE_NOT_APPLIED`: *"disabled is claimed but the element does not carry it — it is still operable
and only the ARIA changed"*. The check existed; the adapter it would have caught had never been
driven into that state.

Repaired in the projection rather than in the renderers, so no adapter has to remember: what a kind
announces and what it enforces come from one place.
