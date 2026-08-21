# ADR 0129: One way back, not three

Status: Accepted

## Context

A multiselect has three destructive actions and none of them can be undone:

    remove a chip          one choice gone
    move a chip            an order a person built, rearranged
    clear the selection     twelve choices gone in one press

The third does not exist yet and is the reason this record does. It was raised as a request — twelve
choices come off one at a time and there is no way back to empty — and answered immediately with a
warning worth more than the request: **a clear-all with no way back is worse than no clear-all**, and
the person who most needs it is the one who will hit it by accident.

Published practice, consulted from outside with no knowledge of this project, is narrower than it
first appears. No success criterion requires a clear-all control at all; twelve removals is a
usability cost, not a conformance failure. At AA, **3.3.4 Error Prevention** covers legal commitments,
financial transactions and deletion of data *in a storage system* — an unsubmitted form selection is
none of those. Only at AAA does **3.3.6** require a reversible, checked or confirmed action.

So this is not a conformance obligation. It is a design decision, and the question that has to be
settled before the control is built is not *whether* undo but **how many undos there are**.

## Decision

**One way back for the whole control, not one per action.**

A single reversal covers the last destructive change whatever produced it — a removal, a move, or a
clear. It is offered the same way, named the same way, and reached the same way in all three cases.

It is an **untimed affordance**, never a toast. A message that disappears after five seconds is a time
limit under **2.2.1 Timing Adjustable at Level A**: it must be possible to turn off, extend, or set to
ten times the default, and none of 2.2.1's exceptions apply to an undo. The snackbar-with-undo that
nearly every design system ships is a Level A failure, and worse in practice than on paper — toasts
routinely sit outside the focus order and outside any live region, so a screen reader user is offered a
return path they are never told about and could not reach in time if they were.

## Consequences

**Three separate undos was the alternative that had to be refused, and refusing it is the whole
decision.** An undo that covers the loudest action and not the quiet ones is worse than none: it
teaches a person that this control has a way back, and then does not have one the next time. A promise
kept three-quarters of the time is a trap with better manners.

It also decides the surface. Three undos are three things a consumer learns and 1.0 keeps stable; one
is one. The deciding principle here is the same one ADR 0014 used — the smallest public surface wins —
and it points the same way.

The cost is that a single reversal has to describe what it is reversing, because "Undo" alone is
ambiguous once it can mean three different things. The affordance names the act: *"12 items cleared —
Undo"*, *"Roma removed — Undo"*, *"Roma moved — Undo"*. That is more work than a bare button and it is
what makes one control legible where three would have been self-describing.

Depth is one. A stack of reversals is a different feature with a different surface, and nothing in the
evidence asks for it.

## Alternatives rejected

**An undo per action, built as each action is built.** The path of least resistance, and the one this
record exists to close: 362 would have shipped with a clear-all undo and left removal and reordering
without one, because each is written on its own day.

**No undo, with a confirmation dialog on clear-all instead.** Correct for a destructive action that is
expensive to rebuild, and heavy for a form field — it interrupts, it needs focus trapping and
restoration, and it trains the reflex dismiss. It also does nothing for removal and reordering, which
is how the three-undos problem arrives by another road.

**A timed toast.** The popular pattern and a 2.2.1 failure. If it is made reachable, announced and
adjustable, it has become the untimed affordance above with extra machinery.

**No clear-all at all.** Defensible — nothing requires it — and it leaves the original complaint
standing: twelve choices come off one at a time.

## Verification

`four-holes-in-a-control-that-holds-many.spec.ts` asserts that a selection can be cleared, and is red
in all three renderers. It does **not** yet assert the return path, and that gap is deliberate until
this record existed to say what the return path is.

The check that fails if this decision is violated in spirit while passing in letter: a clear-all with
an undo, shipped while removal and reordering still have none, satisfies "a selection can be cleared"
and satisfies any test written only against clearing. The assertion that catches it has to exercise all
three actions through the same affordance, and it is owed before 362 lands rather than after.

## Security and privacy

No impact. The reversal restores a value the control already held in this session; nothing is
persisted, and no data crosses a boundary that it had not already crossed.
