# ADR 0173: A position may depend on the field, never on the value

Status: Accepted

Supersedes [ADR 0172](0172-the-trailing-column-carries-one-thing.md).

## Context

ADR 0172 moved a multiselect's two commands — the way back and the clear-all — out of the trailing
column and set them after the chip strip, so each stood with the value it acts on. The column
argument behind it is sound and is not withdrawn here: the trailing edge is the one place every kind
puts an affordance, and that constancy is what lets a person operate a form without reading it.

The arrangement was then measured, and it fails for a reason the record did not consider:

```
remove one value  →  clear-all slides 231 → 140     all three renderers, identical
                     way back slides with it
                     three affordances spread over 884px
```

The chip strip's width is the length of the value. Anything between it and free space moves whenever
a chip arrives or leaves. So the control that discards the field arrives at the position the control
that restores a value had a moment earlier — under the hand of somebody who has just removed
something and is reaching for the way back. ADR 0171 kept these controls drawn while they cannot act
precisely so that nothing moves under a hand; ADR 0172 spent that on the other axis.

The outside view was given the measurement and withdrew its own placement:

> Stand with what you act on is a discoverability rule; never move under a hand is a safety rule.
> Where they pull apart the safety rule decides, without a cost-benefit, because the cost on one side
> is an unchosen destructive action and on the other a slightly longer look. Yours is the worst
> instance: the movement puts the destructive control exactly where the remedial one was.

## Decision

**A control's position may depend on the geometry of the field. It may never depend on the value.**

The value changes under a person's hands; the field does not. Any placement that violates this is
disqualified before proximity to its subject is considered.

For the multiselect that means the commands return to the trailing edge, arranged so the column keeps
its meaning:

```
[ chip chip chip … ]      ↶     gap     ✕     ⌄
                          undo         clear   open
                                               ↑ outermost on every kind
```

- **The opener is outermost, always.** It is the one affordance every kind draws there, so it sits at
  the same distance from the edge on every field and the eye's line down the form lands on openers.
  What a kind draws inboard of it does not move that line.
- **Reserved width whether or not they can act**, which ADR 0171 already required and which now has a
  second reason: a command that collapsed when disabled would move the opener, and the column would
  break every time a field was cleared.
- **A full target of empty space between the way back and the clear-all.** These controls carry no
  target overlay — the box is the target — so the 24px `DESIGN.md` documents for a stacked control is
  also the gap between their hit areas. A finger that pressed the way back and presses again in the
  same place lands on the way back or on nothing, never on the control that discards the field.
- **Order toward the edge: way back, gap, clear-all, opener.** The way back's inboard neighbour is
  free space, which is the safest neighbour a remedial control can have.

**Unchanged from ADR 0172, and not reopened**: a button whose whole visible content is a mark is named
by its action, the mark is hidden from the accessibility tree, and the control carries a `title` with
the words of its name.

## Consequences

The single-column alignment is broken on this one kind, which is the cost ADR 0172 was written to
avoid and which is accepted here as the lesser one. A person scanning still gets the two properties
that make the column worth having: the opener is in the same place on every kind, and nothing in that
column moves when the value changes.

The contract's reading order returns to what it was before ADR 0172, so no released consumer sees an
order change from the pair of records.

**The strongest argument against this record** is that it is the third placement in as many weeks for
the same two controls, and each was argued from a real property. What distinguishes this one is that
it is the first decided against a measurement rather than against a principle, and the constraint it
states — position depends on the field, never on the value — is checkable, which the previous two
were not.

## Alternatives rejected

**A fixed-width slot after the chip strip.** It holds still only if it is anchored to the field's edge
rather than to the row's end, at which point it is the trailing edge with extra steps.

**The leading edge.** It holds still, and it puts "clear everything" ahead of the thing it clears, for
both the eye and a screen reader.

**Keep ADR 0172 and stop the strip from changing width.** The strip's width is the value; reserving
its maximum would leave a field mostly empty at rest, and reserving anything less does not fix it.

## Verification

`npm run test:conformance` checks the part order against the contract in all three renderers.

The measurement itself — that neither command moves when a value arrives or leaves, and that 24px of
nothing separates the two hit areas — is a browser-tier check and is what found this defect. This
record does not claim it has been re-run; the numbers above are the peer's, on the arrangement this
record replaces.

## Amendment: the rule is not about one field's commands

Recorded after the peer's tier came back green, because the title of this record undersells it.

*A position may depend on the field, never on the value* is a constraint on every control this
library draws, not a placement for a multiselect's two commands. Anything sitting between a
variable-length part and free space is on the same conveyor belt, and a chip strip is not the only
variable-length part here.

The second instance, found by looking rather than by a defect report: the `file` field's clear stands
after the list of chosen files, in a column. Its position is the number of files chosen — every
addition pushes it down, every removal pulls it up, and a person removing several one at a time is
pressing into a place that moves between presses. It has been moved to stand with the control that
picks files, which is the part of that field that does not change with what is in it.

What is demonstrated and what is not: the dependence is structural and certain — a column whose
earlier sibling has a variable number of rows. That the clear lands precisely where a per-file
remove was is **not** demonstrated; the two are aligned differently within the row, and no
measurement here says how close they come.

## Security and privacy

No impact. Placement and spacing only; no control gains an act, and nothing crosses a boundary it did
not cross before.
