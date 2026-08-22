# ADR 0127: A strip that scrolls, against the published practice

Status: Superseded by [ADR 0137](0137-a-row-that-wraps-where-it-must.md)

## Context

A closed multiselect shows what was chosen as a single horizontal row of chips that scrolls when there
are more than fit. That was decided directly and in those words — the chips must be able to scroll
inside the control, and the control's own shape is the box they sit in.

An outside accessibility review, consulted with no knowledge of this repository and asked to answer in
absolutes from published practice, ranked that design **last but one** among the ways to handle the
overflow, and ranked wrapping to multiple rows first:

> Horizontal scrolling of a linear list of chips is a **1.4.10 Reflow** problem: at 320 CSS px the
> success criterion forbids two-dimensional scrolling, and the exception is for content that
> *requires* 2D layout for usage or meaning. A list of chosen values does not. Choosing a scrolling
> row is therefore a deliberate departure from an AA criterion, not a neutral layout preference.

That is the only point in a long answer where the published practice and a decision already taken here
are in real conflict. Everything else it said was either adopted or is recorded as an open finding.

Two decisions were written the same night for choices nobody disagreed about, and none for this one.
That is backwards: agreement is cheap to reconstruct, and a departure is exactly the thing a future
reader will relitigate from scratch unless the reasoning survives.

## Decision

**The strip scrolls, and this record is the departure's reasoning rather than its denial.**

The row keeps one line and scrolls horizontally. It is a departure from 1.4.10 at AA and is taken
knowingly, on one ground: **the control must occupy the same height as every other control in the
form**, which is a mandatory rule here and is enforced by
`a-control-taller-than-the-row-it-sits-in.spec.ts`. A wrapping row grows with what is put in it, so
wrapping and that rule cannot both hold. Between a control that changes height as a person fills it
and a row that scrolls, the row was chosen.

The departure is **conditional**, and the conditions are not optional decoration:

- the overflow must be **announced programmatically**, independent of any visual affordance —
  `aria-setsize` and `aria-posinset` on every chip, and the count in the field's own description;
- there must be a **mechanism**, not only a cue, that reaches the hidden chips without a horizontal
  scroll axis — many desktop mice have none;
- every chip must be reachable by keyboard with the focused one scrolled into view.

Ship the scroll without those and the departure stops being a trade and becomes a defect.

**A summary instead of chips was not rejected on its merits.** The same review ranked "12 selected,
chips on demand" above scroll arrows and called it *the honest admission that twelve chips do not
fit*. It is the alternative most likely to supersede this record, and it is written down here so that
the next person to raise it finds that it was considered rather than overlooked.

## Consequences

Everything the strip needs in order to be usable is a consequence of this decision, not a separate
wishlist: the overflow affordance, the set-size announcement, the roving tabindex of
[ADR 0125](0125-a-chip-strip-is-one-thing-to-a-keyboard.md), the tooltip for a truncated label, the
scroll-into-view on focus. A design that needed none of those was available and was not chosen.

The reflow departure is real at 320 CSS px and does not go away by being recorded. Any conformance
claim this project makes at AA must name it.

## Alternatives rejected

**Wrap to multiple rows.** The published practice's first answer, and it removes the problem instead
of mitigating it — reflow at 320px and text resize at 200% both stop being questions. Rejected because
it cannot hold the one-row-per-control rule: the control's height would then be set by how much a
person had chosen, which is the defect recorded as finding 356 and repaired.

**A summary in place of the chips.** See above — not rejected on its merits, and the likeliest
successor. Its cost is that removing one choice becomes two actions rather than one.

**Scroll arrow buttons as the mechanism.** Acceptable but never sufficient: they reveal content to a
pointer user and tell assistive technology nothing, so the programmatic conditions above are still
owed.

**An edge gradient as the only affordance.** Rejected outright. It is not a control, it is invisible
to assistive technology, and it is removed entirely by forced-colors mode — so the population most
likely to be zoomed and clipped is the one for which the only cue does not render.

## Verification

`a-control-taller-than-the-row-it-sits-in.spec.ts` holds the rule this departure exists to serve: every
kind draws a box of the same height, and a multiselect keeps its height whatever it holds. Green in all
three renderers.

`four-holes-in-a-control-that-holds-many.spec.ts` holds the first condition: with twelve chosen and six
visible, something must say the other six exist. **Red in all three today**, which means the departure
is currently unpaid for rather than justified. The conditions above are what turn this record from a
statement of intent into a defensible position, and one of them is open.

The check that fails if this decision is violated quietly: a strip that stops scrolling and starts
wrapping would turn the height spec red rather than this one, which is the correct place for it to
show.

## Security and privacy

No impact. This is a layout and announcement decision; no data crosses a boundary.
