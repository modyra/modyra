# ADR 0011: A capability names the event it depends on

Status: Accepted

## Context

`dismissOnOutsidePointer` was a boolean. It said an overlay is dismissed by a pointer outside it, and
never said **which event**.

Three renderers each answered independently: two bound `pointerdown`, one bound `click`. The
difference is observable and reaches real users. `pointerdown` fires on press; `click` only on a
completed press-and-release over the same target. So a drag that begins outside an open popup — the
gesture a touch user makes to scroll the page — dismissed the popup on two renderers and not on the
third.

Both behaviours were asserted, in browsers, in opposite directions, by suites that both passed. That
is the diagnostic: the contract had a hole, every renderer filled it, and conformance could not
object because the contract did not have an opinion to violate.

This generalises. A boolean capability answers *whether*, and every question of *how* it then leaves
open becomes a per-renderer choice that looks like an implementation detail and behaves like a
specification.

## Decision

A capability that depends on a specific event **names that event**.

```ts
dismissOnOutsidePointer: false | { readonly event: "pointerdown" | "click" }
```

The value is `click`, decided by the owner: a drag that begins outside is not necessarily a
dismissal, and a user may press, think better of it, and return.

Renderers **read the event from the capability**. None names one, so this cannot silently become a
per-renderer choice again.

The general rule: when a capability's observable behaviour depends on a choice the contract has not
made, the contract makes it. A `boolean` is the right shape only when there is nothing left to decide
after `true`.

## Consequences

- Widening a capability from `boolean` to a union is **breaking**: `caps.x === true` stops holding
  and stops type-checking. Classified major, deliberately and consistently — the previous capability
  change in the same release was withdrawn as major for the same reason, and being inconsistent about
  it would make the semver verdict depend on who wrote the changeset.
- Capabilities become larger and more specific. Accepted: a capability that cannot be violated is not
  a contract.
- Renderers lose local latitude they were exercising unknowingly.

## Alternatives rejected

- **`pointerdown`**, the majority behaviour and the recommendation put to the owner. Rejected in
  favour of the gesture argument above. Recorded because two of three renderers had it, so a future
  reader will find the majority and wonder.
- **Leave it renderer-defined, document the difference.** A difference two renderers do not know they
  have is not a documented difference.
- **Keep the boolean, specify the event in prose.** Prose has no check, and this is precisely what
  the previous state amounted to.

## Verification

- `e2e/plain/dismiss.spec.ts` and `e2e/touch.spec.ts` — the declared path asserted in a real browser
  on the renderers that had disagreed.
- `npm run test:contracts` — the capability's shape is part of the contract snapshot, and
  `contract-diff` classifies a change to it with a semver verdict.

**Known incompleteness, recorded rather than closed.** Naming the pointer event was necessary and is
not sufficient: `@modyra/plain`'s select also closes on `focusout` when focus leaves the widget, so a
drag that presses outside still dismisses it through a second path the contract does not name. The
e2e suite asserts the declared path in isolation and records the focus path *as it behaves*, rather
than asserting a contract that does not yet cover it.

## Security and privacy

Minor and real. Dismissal timing decides how long a popup's contents stay on screen — an
address list, a set of options revealing account structure. A renderer that dismisses later than the
contract says is a renderer that displays longer than the specification allows.
