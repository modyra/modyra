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

> **Amended 2026-08-03 — completion is the pointer's own release, with `click` as the tail.**
>
> The paragraph above is kept because its reasoning is what makes the amendment legible, and because
> the risk it names is real. What it got wrong is *which signal* protects against that risk.
>
> The clause assumed every engine judges an activation and reports it. WebKit does not: it
> synthesises no mouse events and no `click` for a tap on an element it does not consider clickable,
> and a page's own background is not one. Measured, tapping an `<h1>` with a list open:
>
> | engine | events delivered |
> | --- | --- |
> | Chromium | `pointerdown` `touchstart` `pointerup` `touchend` `mousedown` `mouseup` `click` |
> | WebKit | `pointerdown` `touchstart` `pointerup` `touchend` — and nothing else |
>
> So on Safari, desktop and iOS, the pair never completed and **nothing dismissed** — on the engine
> every iOS browser is required to use.
>
> The scroll gesture the original clause protects is still protected, by a signal that is delivered
> rather than inferred: a browser that takes a gesture over to scroll fires `pointercancel`, which
> this rule already treats as abandonment. The absence of a click was standing in for that.
>
> `pointerup` now completes the interaction, subject to the same origin and pointer-identity rules.
> `click` stays and normally does nothing — the release has already left the machine idle, and an
> idle machine dismisses nothing — but it catches an interaction whose release never arrived, so the
> change does not trade one engine's gap for another's.
>
> One behaviour changes beyond the fix, and it is a correction rather than a cost: pressing outside
> and releasing **inside** the popup no longer dismisses. It used to, because the browser fired the
> click on a common ancestor outside the branch. The interaction ended inside, so under this ADR's
> own rule it should never have dismissed.

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

**On three engines, since the 2026-08-03 amendment.** The clause that moved would not have been
caught on one: `playwright.config.ts` ran Chromium only, where the missing `click` does not exist as
a phenomenon. `e2e/plain/dismiss.spec.ts:30` and `e2e/touch.spec.ts:36` are the rows that failed on
WebKit, and `packages/widgets/test/dismissal.spec.mjs` §4 now asserts the release path directly —
including a release with no click at all, which is the shape WebKit delivers.

The `pointercancel` row remains Chromium-only and says so in the spec: only CDP can make a browser
send a genuine cancel, and a dispatched event would assert the handler rather than the browser. That
matters more after this amendment than before it, because `pointercancel` is now the *only* thing
standing between a scroll and a dismissal.

**The `pointercancel` row is asserted, and this was not certain in advance.** A cancelled pointer is
the browser taking a gesture over, not an event a script dispatches, so the row was expected to ship
held by reasoning. It does not: CDP's `Input.dispatchTouchEvent` with `type: "touchCancel"` makes the
browser emit a real `pointercancel`, verified by observing the sequence before relying on it.
`e2e/plain/dismiss.spec.ts` uses it.

That assertion aims the gesture *inside* the popup rather than outside. Pressing outside also moves
focus, and the `focusout` path below would close the popup for a reason unrelated to the pointer —
so aiming outside would have measured the wrong thing and passed.

**The focus path is now named and subordinated.** `dismissOnFocusOutside` declares that focus leaving
the logical branch closes an overlay — which is what makes Tab out of a popup close it — and the
precedence is explicit: while an interaction that began **inside** the branch is unresolved, focus
decides nothing. All three renderers consult `interactionFromInside()` rather than each deciding.

**The precedence gate is asserted at the rule, not in a browser, and the reason is measured.** In
`@modyra/plain`'s select an inside-origin drag never produces a `focusout` at all: an option calls
`preventDefault` on `mousedown` to keep focus in the search box, so `document.activeElement` never
leaves it. Observed sequence: `pointerdown:option`, `pointerup:…`, `click:BODY`, no focus event.
Removing the gate leaves the browser assertion green — so the gate is defensive code this renderer
cannot currently exercise, and saying so is worth more than a test that appears to cover it.
`packages/widgets/test/dismissal.spec.mjs` §13 asserts the rule directly. The gate becomes
load-bearing in Plain the day that `preventDefault` goes, and it may already be reachable in Lit,
whose focus handling had no containment guard before this work.

**Not covered by this decision, and each needing its own record:** nested popups and the order they
dismiss in; a `reason` on every close so one interaction cannot produce two transitions; the full
per-device acceptance matrix.

## Security and privacy

Inherited from ADR 0011 and unchanged in kind: dismissal timing decides how long a popup's contents
stay on screen — an address list, a set of options that reveals account structure. This decision makes
popups dismiss *less* eagerly than `pointerdown` did on two renderers, so contents remain visible
through gestures that previously closed them. That is a deliberate trade of exposure for correctness,
and it is bounded: any completed press-and-release outside still dismisses, and `Escape` always does.
