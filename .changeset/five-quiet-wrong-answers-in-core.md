---
"@modyra/core": patch
---

Five places where core answered quietly and wrongly

- A computed that threw stopped telling the things reading it about later changes, so an effect
  stayed on the failure after the computed had recovered. Dependents are now notified again.
- Redo stayed offered after a pending edit had made it impossible, and undo/redo could grow the
  undo stack beyond `maxEntries`. `canRedo` follows the stack and every push respects the limit.
- `patchValue({ a: undefined })` wrote `undefined` and the field vanished from `value()`. It now
  leaves the field as it was, as `setValue` already did.
- `pattern(/x/g)` alternated between passing and failing on the same value, because a global
  expression remembers where it stopped. Each test starts from the beginning.
- A server snapshot called a form valid when a form-level rule failed, and invalid when only a
  disabled field failed. Its verdict now is the one the form itself reaches.
