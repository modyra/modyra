# ADR 0125: A chip strip is one thing to a keyboard

Status: Accepted

## Context

A multiselect that holds twelve choices costs a person twenty-six tab stops to get past. Measured, on
all three renderers:

    two chosen       6 tab stops to reach the next field
    twelve chosen   26

Every chip is a stop and so is its remove button, so the price of crossing a control is set by how much
was put into it. In counter mode each chip also carries two steppers, which puts the same twelve at
roughly four stops each.

Three separate pieces of work arrived at this strip within one evening, and each assumed a different
answer to the same question — *what is a chip, to a keyboard?*

- **reordering** wants `Alt`+arrows to move a chip along the strip;
- **removal** wants a rule for where focus goes when the focused chip leaves the DOM, which
  [ADR 0126](0126-focus-is-placed-not-dropped.md) settles;
- **the tab cost** wants the strip to stop being a queue of stops.

They are not three features. They are one focus model, and building any of them against today's strip
means rebuilding it when the next arrives. Reordering was being built on a strip where every chip is a
tab stop, which is the concrete instance that forced this record: after a move, which chip is focused
depends on document order, because there is no index for focus to be expressed in.

## Decision

**The chips strip is a single tab stop with a roving tabindex, and every key that acts on a chip is
declared in `MDY_WIDGET_KEYBOARD` rather than at a call site.**

One chip carries `tabindex="0"` and the rest carry `-1`. Tab reaches the strip once and leaves it once.
Inside it:

    ArrowLeft / ArrowRight    move focus between chips
    Alt + ArrowLeft / Right   move the focused chip along the strip
    Home / End                jump to the ends
    Backspace / Delete        remove the focused chip

The reorder intent is `move-selected`, carried once in the keyboard table with the direction as data,
so a renderer reads the binding rather than restating the keystroke. Keyboard before pointer: the
pointer door is built on the same intent afterwards, never as its own path.

`reorderable` defaults to off, and when it is off the control offers **no** way to move — not a hidden
handle with a live keystroke behind it.

## Consequences

The cost of leaving the field stops depending on what is in it, which is the property the check
asserts; the mechanism is not asserted, so a different focus model that keeps the count flat is free to
replace this one.

Arrow keys acquire a second meaning inside this control: on a closed multiselect they move between
chips, where on an open one they move through options. That is a real cost and it is paid knowingly —
the alternative is Tab keeping its twenty-six presses.

A roving index has to survive the strip scrolling, since a focused chip out of view is a keyboard trap.
`two-doors-to-one-order.spec.ts` already asserts a chip scrolled out of the strip comes back into view
when focused, and that assertion becomes load-bearing here rather than incidental.

Work sequenced the other way has to be redone. This record exists to make that sequence explicit rather
than rediscovered.

## Alternatives rejected

**Leave each chip a tab stop.** It is what the DOM gives for free and it is why nobody chose it —
twenty-six presses is not a design, it is the absence of one. It also makes reordering's post-move
focus undefined, because there is no index to express it in.

**Build reordering first, on today's strip, and add the roving index later.** Considered seriously,
because reordering was already in flight. Rejected because the move's focus behaviour would be written
against document order and rewritten against a roving index — the same work twice, and the intermediate
state ships a control where `Alt`+arrow moves a chip that then loses its place.

**Take the chips out of the tab order entirely** and reach them only through the popup. One stop, no
new key meanings — and no way to remove a chip without opening the control, which makes the strip
decorative for anyone not using a pointer.

## Verification

`four-holes-in-a-control-that-holds-many.spec.ts` asserts the property rather than the mechanism: the
number of tab stops needed to cross the field with twelve chosen equals the number with two. It fails
at 26 against 6 today.

The check that would fail if this decision were violated in spirit while passing in letter: a strip that
kept one tab stop but made the chips unreachable would satisfy the count and lose removal. The
companion assertions — a chip is focusable, a focused chip scrolled out of view returns, removal places
focus by [ADR 0126](0126-focus-is-placed-not-dropped.md)'s rule — are what stop that reading.

## Security and privacy

No impact. This changes how focus moves within a control; no data crosses a boundary, and no input is
newly trusted.
