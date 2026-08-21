# ADR 0128: A chip is one thing, not a cell

Status: Accepted

## Context

[ADR 0125](0125-a-chip-strip-is-one-thing-to-a-keyboard.md) made the chip strip a single tab stop with
a roving tabindex. An outside accessibility review, consulted from published practice with no knowledge
of this repository, opened its answer by naming the pattern that decision implies:

> A chip is not one control, it is a container of controls (label, remove, and in the quantity
> configuration a decrement, a value and an increment). The APG has exactly one composite pattern for
> "one tab stop, items with several operable children": **grid**. Everything below assumes the row is
> `role="grid"` with a single row, each chip a `gridcell`.

That premise governed every other answer it gave, including `Enter`/`F2` to enter a cell and move among
the controls inside it. The roving tabindex was built without it. `esecutore` asked for this to be
settled before the pointer door, because a drag target attaches to whatever the chip turns out to be.

## Decision

**No grid role. A chip is one operable thing, and its buttons are pointer affordances that are not
separately focusable.**

Grid exists to solve *cells with several operable children*. The design already removed the children:
when the roving tabindex landed, the remove button and both steppers left the tab order with the chip,
which is what took twelve chosen from twenty-six tab stops to three. Adopting grid would put them back
and then supply `Enter`/`F2` as the way past them — a second mode, on a strip, to reach controls the
keyboard already reaches directly.

Every action a chip's buttons perform is reachable by a key on the chip itself:

    Backspace / Delete        remove
    Alt + ArrowLeft / Right   move
    ArrowUp / ArrowDown       the quantity, in counter mode

The buttons stay visible and stay clickable. They are how a pointer does what a key already does — the
same one-intent-two-doors rule the reorder specs assert, applied to the chip's own controls.

**This is a departure from the APG's composite pattern and is taken on the smallest-surface principle**:
prefer whichever option adds least to what a consumer must learn and 1.0 must keep stable. Grid adds a
role, a cell role, a second interaction mode, and a set of expectations about rows and columns that a
one-row strip of chips does not have. Keys on the chip add keys.

## Consequences

The chip must carry an accessible name that states everything its buttons would have said —
[368](../../battle-tests/reports/open-findings.md)'s `aria-posinset`/`aria-setsize` are part of that,
not a separate nicety, because "Roma, 3 of 12" is what a `gridcell` would have given for free.

Every key must work, in every renderer, or a chip is a control a keyboard can focus and cannot operate
— which is worse than a grid with an extra mode. `every-key-a-kind-declares` is the check that holds
this, and it went red once already for exactly this reason: plain gated every chip key behind
`reorderable`, so six declared keys did nothing.

A screen reader announces a chip as a button, not as a cell of a grid, so a user gets no "row 1,
column 3" scaffolding. That scaffolding is what `aria-posinset` replaces, and it is why that finding is
a condition of this decision rather than an improvement to it.

**[373](../../battle-tests/reports/open-findings.md) is narrowed by this record but not decided by
it.** A counter chip's quantity may still be exposed as a `spinbutton` so `ArrowUp`/`ArrowDown` are
announced natively — that is compatible with a chip that is one tab stop, provided the spinbutton is
the chip rather than a focusable child of it.

## Alternatives rejected

**`role="grid"` with `gridcell` chips**, as the review specified. It is the published answer and it is
rejected knowingly. Its cost is the interaction mode: `Enter` or `F2` to get inside a chip, `Escape` to
get out, and a person who does not know that is stranded at a chip whose buttons they can see and
cannot reach. Keys on the chip have no inside to get into.

**Grid role without the interaction mode** — the shape most implementations ship. Rejected as the worst
of both: it promises a screen reader a structure whose behaviour is not there, so `Ctrl`+arrow
navigation and cell announcements describe something the page will not do.

**Leave each button focusable and skip the roving index.** This is what the control did, and it cost
twenty-six tab stops for twelve choices. Rejected in ADR 0125 and not reopened here.

## Verification

`four-holes-in-a-control-that-holds-many.spec.ts` asserts the property this decision is answerable for:
the number of tab stops needed to cross the field does not grow with what is in the strip. Green in all
three renderers.

The check that fails if this decision is violated in spirit while passing in letter: a strip that kept
one tab stop and left a chip's actions unreachable would satisfy the count and lose removal.
`every-key-a-kind-declares` is that check, and it has already caught the exact case.

**What is not yet checked, and is the honest gap:** nothing asserts that a chip's accessible name
carries its position and set size, so the scaffolding this record trades away is not yet verified as
replaced. That is finding 368 and it is a condition of this decision, not a follow-up to it.

## Security and privacy

No impact. Roles and key handling move no data and grant no capability.
