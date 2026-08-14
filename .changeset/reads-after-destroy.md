---
"@modyra/core": patch
---

`getValue()` and the `value` signal answer after `destroy()`

`destroy()` removes every field, so building the value from the engine's flat map produced a shape
the schema does not describe and the read threw `[modyra] Flat value does not match schema shape` —
for every schema shape, including a plain one.

Teardown is a read path. A renderer unmounts while a computed evaluates once more, a component logs
what it held, a cleanup handler saves it: all of them read a form that has just been destroyed, and
an internal invariant's message is not an answer.

Both now return what the form held when it was destroyed. `submitValue()`, `state`, `fieldNames()`
and `getChanges()` already answered and are unchanged.
