---
"@modyra/core": patch
---

A guard claims only what the door takes

`isPathRef` answered on the `path` member alone, so it was the one operand guard that said nothing
about what else the object carried. `{ path: "a", self: true }` was handed to a consumer as a path
reference while `validateExpression` turned the same operand away — a guard published for telling the
shapes apart claiming one the contract will not accept.

It asks `namesOneThing` now, as `isSelfRef`, `isRootRef` and `isContextRef` already did. One operand
names one thing (ADR 0092), at every door that reads it.
