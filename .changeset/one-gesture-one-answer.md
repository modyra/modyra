---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
---

The dismissal names its event, and it is `click`.

`dismissOnOutsidePointer` said an overlay is dismissed by a pointer outside it and never said
**which event**. Three adapters each picked one: `@modyra/plain` and `@modyra/lit` bound
`pointerdown`, `@modyra/angular` bound `click`. The choice is observable — `pointerdown` fires on
press, `click` only on a completed press-and-release over the same target — so a drag beginning
outside an open popup dismissed on two renderers and not on the third.

```ts
dismissOnOutsidePointer: false | { readonly event: "pointerdown" | "click" }
```

**`click`**, decided by the owner: a drag that begins outside is not necessarily a dismissal, and a
user may press, think better of it, and return. `@modyra/plain` and `@modyra/lit` now read the event
from the capability instead of naming one, so it cannot become a per-renderer choice again.

**Major**, not the minor this was planned as. The shape is additive in what it can express, but
`boolean` became a union: `caps.dismissOnOutsidePointer === true` no longer holds and no longer
type-checks. The previous capability change in this release was withdrawn as major for the same
reason, and being inconsistent about it would make the classification a matter of who wrote the
changeset.

**What this does not fix, and the tests now say so.** Naming the pointer event was necessary and is
not sufficient. `@modyra/plain`'s select also closes on `focusout` when focus leaves the widget, so a
drag that presses outside still dismisses it — through a second path the contract does not name.
`e2e/plain/dismiss.spec.ts` asserts the declared path in isolation (a completed click) and records
the focus path as it behaves, rather than asserting the contract as it now reads.
