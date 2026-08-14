# ADR 0049: A released custodian owes no focus

Status: Accepted

## Context

`createFocusCustodian` in `@modyra/widgets` opens with the rule the module exists for: focus is
borrowed, not taken. A widget remembers who held focus, takes it, and hands it back when it closes.

[A11Y-002](../../battle-tests/adversarial/lifecycle/focus-custodian.battle.test.mjs) found the taking
on one route: a widget that closes and is then disposed calls `restore()` twice, and the second call
found nothing remembered and fell through to the first focusable *inside* the widget — pulling focus
back out of wherever the first call had put it. That is fixed by tracking whether focus is currently
borrowed, which is a different question from whether an element is remembered.

`release()` reaches the same place by another route, and the project's own evidence disagreed with
itself:

- the method is named for finishing, and its one caller in the workspace is
  `MdyOverlayControl`'s `DestroyRef.onDestroy` — teardown, plainly;
- `packages/widgets/test/focus.spec.mjs` pinned the opposite, asserting that a `restore()` after a
  `release()` still falls back inside the widget, with a comment showing the case was constructed
  deliberately: the remembered owner was placed *outside* the widget precisely so that falling back
  inside it is distinguishable from handing focus back.

So one reading is "the thing I remembered is gone, put focus somewhere sensible" and the other is "I
am done, I owe nothing". The docblock said neither.

## Decision

**`release()` ends the borrow.** A restore afterwards places no focus and returns `null`. A widget
being torn down does not take focus into itself, whichever route reaches that state — a second
`restore()`, or a `restore()` after a `release()`.

**Naming a target is still honoured.** `restore(preferred)` places focus whether anything is borrowed
or not: naming an element is the caller placing focus deliberately, which is a different request from
asking for what the widget borrowed.

**The fallback keeps the case it was written for.** While the borrow is live and the remembered owner
has left the document, `restore()` still falls back inside the widget — somewhere real beats nowhere,
and that is what a user needs when the element they came from has been removed under them.

## Consequences

A consumer that called `release()` and relied on the next `restore()` to place focus inside the
widget now gets `null`. The workspace has one caller and it releases at destroy, so nothing here
changes; a consumer outside it that wants the old behaviour names the target.

`focus.spec.mjs`'s pinned assertion is replaced rather than deleted, and the case its comment was
protecting — distinguishing a fallback from a hand-back — is now covered by the removed-owner test,
which is the situation the fallback exists for.

The custodian holds one more piece of state, and `remember()`/`restore()`/`release()` must keep it
consistent. That is the cost of the two questions being genuinely distinct: a widget that opened
while nothing was focused has borrowed focus and holds no element.

## Alternatives rejected

**Leave `release()` as it was.** Defensible on the strength of that test comment — somebody chose the
fallback deliberately — and it leaves a disposed widget able to take focus, which is the accessibility
failure A11Y-002 is about. The same defect through a second door is still the defect.

**Drop the fallback entirely, on every path.** Simpler, and it strands a keyboard user when the
element they came from was removed while the widget was open. Focus somewhere in the widget is
recoverable; focus on `<body>` in the middle of a form is not.

**Add a separate `dispose()` and leave `release()` alone.** Two methods where the difference is what
the second one already claims by its name, and every consumer would have to learn which is which.

## Verification

- `packages/widgets/test/focus.spec.mjs` — a released custodian places no focus and leaves focus
  where it is; it still honours a named element; a remembered owner that has gone still falls back
  inside the widget; a second restore returns `null` after a first one succeeded.
- `battle-tests/adversarial/lifecycle/focus-custodian.battle.test.mjs` — the attack that found the
  double-restore half, with the nested-overlay and removed-owner fallbacks pinned beside it.
- `npm run test:angular` covers `MdyOverlayControl`, the one caller of `release()` in the workspace.

## Security and privacy

None. Focus placement is not a trust boundary, and no value crosses one here. The accessibility
consequence is the substance: focus taken by a widget that is being destroyed leaves a keyboard or
screen-reader user in a place that is about to stop existing.
