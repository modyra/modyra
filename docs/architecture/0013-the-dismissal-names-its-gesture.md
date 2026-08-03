# ADR 0013: The dismissal names its gesture, not a single event

Status: Accepted — supersedes [ADR 0011](0011-a-capability-names-its-event.md)

## Context

[ADR 0011](0011-a-capability-names-its-event.md) established the principle that a capability names
what its observable behaviour depends on, and applied it by giving `dismissOnOutsidePointer` an event:

```ts
dismissOnOutsidePointer: false | { readonly event: "pointerdown" | "click" }
```

The value chosen was `click`, with this reasoning recorded: *"a drag that begins outside is not
necessarily a dismissal, and a user may press, think better of it, and return."*

That principle holds. The shape does not, for two reasons.

**One event cannot express the reasoning that chose it.** The argument for `click` is about where a
gesture *ends* relative to where it *began* — press outside, return inside, no dismissal. `click`
approximates that by firing only on a completed press-and-release, but it is an approximation: it
says nothing about a drag that begins *inside* the popup and ends outside, which is what selecting
text in a popup looks like. `pointerdown` cannot express it at all.

**The renderers never adopted it.** `packages/widgets/src/catalog.ts:388` hardcodes
`{ event: "click" }` for all six overlay kinds, while `@modyra/plain` and `@modyra/lit` still bind
`pointerdown` directly. So the contract and two of three renderers disagree today, in the very
capability ADR 0011 created to stop that.

ADR 0011 also recorded a known incompleteness that is still open: `@modyra/plain`'s select closes on
`focusout` as well (`packages/plain/src/fields/select-field.ts:139-140`), a second dismissal path the
contract does not name.

## Decision

Dismissal is defined by an **interaction**, not by one event. An interaction has an origin and a
completion, and both decide.

```ts
dismissOnOutsidePointer: false | "light-dismiss"
```

> An overlay closes when a primary interaction that **began** outside its logical branch is
> **completed** outside that branch. An interaction that began inside never dismisses, however far
> outside it ends.

| origin | completion | outcome |
| --- | --- | --- |
| inside | `click` anywhere | keep open |
| outside | `click` inside | keep open |
| outside | `click` outside | **dismiss** |
| either | `pointercancel` | keep open |
| none observed | `click` outside | keep open |
| — | `Escape` | **dismiss** |

**Completion is `click`, not `pointerup`.** A drag ending on a different element than it began on
produces no `click` at all — the gesture a touch user makes to scroll the page behind an open popup.
Completing on `pointerup` dismisses there; completing on `click` leaves the browser to decide what
counts as an activation, and the origin check only prevents the false positives it cannot see.

**Inside means the logical branch**, not the popup element: the invoker, the popup, its descendants,
portalled content and any child popup. A renderer supplies that predicate — only it knows where its
portal went — and the rule stays here.

Three further invariants, because each is a way to dismiss something the user did not ask to close:

- **Primary pointer, primary button only.** A right-click opens a context menu; closing the popup
  underneath it is not the request. A second finger's `pointerup` does not complete the first
  finger's interaction, so events are paired by `pointerId`.
- **`pointercancel` never dismisses**, and cancels only the interaction it belongs to.
- **A `click` with no observed interaction never dismisses.** A keyboard activation or a programmatic
  `.click()` has no pointer behind it, and a capability naming a pointer must not be satisfied by one.

An interaction is abandoned, not completed, on `blur`, on the document being hidden, and on unmount.

`Escape` already behaves this way in both keyboard paths (`packages/widgets/src/behavior.ts:282` and
`:338`). It is stated here so the rule reads complete, not because it changes.

One implementation lives in `@modyra/widgets` as `createLightDismiss`, with the state machine
explicit — `idle`, `tracking-inside`, `tracking-outside`, `cancelled`, `dismissed`. Every renderer
calls it and none binds its own decision, which is what let the divergence exist.

## Consequences

- **Breaking, and classified major.** `{ event }` becomes `{ mode }`; any consumer reading
  `caps.dismissOnOutsidePointer.event` stops compiling. ADR 0011 classified the previous widening of
  this same capability as major for the same reason, and being inconsistent about it would make the
  semver verdict depend on who wrote the changeset.
- A renderer must now track state between two events rather than reacting to one. That is more
  machinery, and it is why the rule is implemented once in `@modyra/widgets` rather than three times.
- `@modyra/angular` (`click`), `@modyra/plain` and `@modyra/lit` (`pointerdown`) all change
  behaviour. Two existing browser assertions are deliberately inverted rather than deleted.
- **The `focusout` path is still not named by the contract**, and this decision does not close it.
  `@modyra/plain`'s select can still dismiss through a route the contract has no opinion about, which
  means the gesture rule can be satisfied and the popup close anyway. Carried forward from ADR 0011
  as an open incompleteness, not silently dropped.
- The rule assumes pointer events. A renderer on a platform without them — React Native, which
  `docs/guides/react-native.md` treats as open work — cannot implement this capability and must
  declare `false`.

## Alternatives rejected

- **Keep `{ event: "click" }`** (ADR 0011's decision). It is the closest single event to the intended
  behaviour, and it requires no new machinery. Rejected because it cannot express the inside→outside
  drag, and because two renderers demonstrably did not implement it — a contract two renderers ignore
  is evidence the shape is wrong, not that the renderers are lazy.
- **`{ event: "pointerdown" }`**, the majority behaviour. Rejected in ADR 0011 and rejected again for
  the same reason: it dismisses on a press the user has not completed.
- **Per-kind choice of gesture.** Considered and put to the owner. Rejected because no kind has a
  stated reason to differ, and a knob added before a case needs it is a wider contract surface that
  every renderer must then honour. If a kind ever needs it, widening `mode` is a minor change.
- **Leave it renderer-defined and document the difference.** ADR 0011 already rejected this, and the
  intervening state — a contract saying `click` while two renderers bound `pointerdown` — is what
  that option looks like in practice.

## Verification

- `e2e/plain/dismiss.spec.ts` extended to all six rows of the table above, per renderer.
- `e2e/touch.spec.ts:45` inverted: the drag beginning outside no longer dismisses.
- `npm run test:contracts` — the capability's shape is in the contract snapshot, and `contract-diff`
  gives it a semver verdict.
- `npm run test:e2e` — the gesture rules are browser behaviour and are asserted in a browser.

**The `pointercancel` row is asserted, and this was not certain in advance.** A cancelled pointer is
the browser taking a gesture over, not an event a script dispatches, so the row was expected to ship
held by reasoning. It does not: CDP's `Input.dispatchTouchEvent` with `type: "touchCancel"` makes the
browser emit a real `pointercancel`, verified by observing the sequence before relying on it.
`e2e/plain/dismiss.spec.ts` uses it.

That assertion aims the gesture *inside* the popup rather than outside. Pressing outside also moves
focus, and the `focusout` path below would close the popup for a reason unrelated to the pointer —
so aiming outside would have measured the wrong thing and passed.

**Recorded incompleteness, and now a defect rather than a gap.** `@modyra/plain`'s select still
closes on `focusout` (`packages/plain/src/fields/select-field.ts:139-140`), a dismissal path this
decision does not name. That is worse than an omission: a rule refusing to dismiss while a second
path closes the popup anyway is a rule that only appears to be in control.

The precedence this decision requires — a `focusout` may not close while an interaction that began
**inside** the branch is still in flight — is **not yet implemented**, and the case is not yet
asserted. Any dismissal on focus leaving belongs to a separate capability
(`dismissOnFocusOutside`), not to this one. `e2e/plain/dismiss.spec.ts` asserts the current
behaviour as it is, so the gap stays visible rather than being papered over.

**Not covered by this decision, and each needing its own record:** nested popups and the order they
dismiss in; a `reason` on every close so one interaction cannot produce two transitions; the full
per-device acceptance matrix.

## Security and privacy

Inherited from ADR 0011 and unchanged in kind: dismissal timing decides how long a popup's contents
stay on screen — an address list, a set of options that reveals account structure. This decision makes
popups dismiss *less* eagerly than `pointerdown` did on two renderers, so contents remain visible
through gestures that previously closed them. That is a deliberate trade of exposure for correctness,
and it is bounded: any completed press-and-release outside still dismisses, and `Escape` always does.
