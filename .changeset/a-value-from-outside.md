---
"@modyra/core": minor
---

Milestone B, dimension 6 completed: the value lifecycle, and the doorway it was missing.

A dynamic field now guards its own shape. `oneOf` already whitelisted the option kinds against a
value that did not come from the widget — a restored draft, a network config, a scripted `set()` —
and every other kind had no such guard: a text field handed `42` reported itself **valid**, because
every rule it owned asked whether the value was *empty* and none asked whether it was a string.
`valueShape` closes that, derived from `MDY_VALUE_CONTRACTS` rather than restated per kind.

It deliberately leaves nullish alone. Whether a field may be empty is `required`'s question, and
answering it here too would make an optional field invalid for holding nothing.

The rest of the dimension — how what a field holds changes — is pinned rather than added, because
the engine already had it right: a programmatic write does not make a field dirty, touched and dirty
are independent of validity, and `reset` restores the value and clears both. Those semantics come
from the engine every adapter shares, so pinning them once pins them for all three.

**Why here and not as an event surface.** The three adapters have no common one — Angular emits
component outputs, Lit one custom event, Plain callbacks — and `MdyUiCommand` is a list of effects a
host performs, not events it observes. What dimension 6 actually enumerates is the value lifecycle,
and that lives on the field handle.
