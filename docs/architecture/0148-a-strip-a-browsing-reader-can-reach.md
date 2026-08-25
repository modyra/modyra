# ADR 0148: A strip a browsing reader can reach

Status: Accepted

Supersedes [ADR 0138](0138-a-chip-is-an-item-not-a-number.md).

## Context

ADR 0138 made every chip a `listitem` inside a `list`. It weighed that against `spinbutton` and
against `grid`, and its reasoning holds on everything it knew. **It did not know this:**

A screen reader on Windows has two modes, and the switch between them is automatic and decided by the
role of the focused element.

```
switch        combobox · listbox · tree · menubar · slider · spinbutton · tab · textbox
              and the children of a composite: option inside listbox, gridcell inside grid
do not        button · switch · group · link · a div with tabindex · listitem
```

Measured, identical in all three renderers:

```
strip           role="list"
focused chip    role="listitem", tabindex="0"
```

**So the strip's entire keyboard model never reaches the code for somebody who arrived by browsing.**
They press `ArrowRight` and the virtual cursor moves; focus stays on the chip; the two drift apart and
do not realign on their own.

And browsing is the ordinary way to arrive: by heading, by landmark, by jumping to the next form
field. `Tab` is what a person uses *inside* a form, after reaching it.

**The failure is silent and asymmetric.** Somebody who arrived with `Tab` has the whole model;
somebody who arrived by browsing has none of it and no way to learn why. They do not get an error.
They get a control that does not answer.

**And it may not be answered with two experiences.** A control that behaves differently according to
how a person reached it is not learnable, because the deciding variable is invisible and is not even
theirs. So the repair is not choosing which of the two to serve: it is a pair of roles for which both
routes land in the same place.

## Decision

**The strip is a `grid` and every chip is a `gridcell`, always — whatever the chip holds.**

`always` is the whole of it. ADR 0138 rejected the grid because it arrived *with the quantity*: a row
that is a list while nobody has taken two of anything and a grid the moment somebody does is a control
whose keyboard model changes underneath a person as a consequence of what they chose. **That objection
is against a conditional grid and does not reach an unconditional one.** Used always, there is no
change to be surprised by, and the property ADR 0138 was protecting — one keyboard model regardless of
contents — is kept intact.

`gridcell` carries a position, so `aria-posinset` and `aria-setsize` keep meaning what ADR 0137 paid
for. And a cell may legitimately contain buttons, which is what a chip is: a thing with buttons in it.

## Consequences

**A grid promises two-dimensional navigation to a strip that has one row.** `ArrowUp` and `ArrowDown`
have somewhere to go in a grid and nowhere to go here. That is the cost, it is real, and it is smaller
than the cost it replaces: a promise a person can test in one keypress against a keyboard model that
never arrives at all.

**`Enter` and `F2` come back into play.** ADR 0138 recorded a collision disappearing with the grid —
the grab-to-reorder gesture uses `Enter`, and a `gridcell` enters its interaction mode with `Enter` or
`F2`. That collision returns, and it is now this record's to resolve rather than one it can note as
avoided.

**`Home`/`End` regain two meanings** — the row's ends, and whatever the focused cell's contents make
of them — for the same reason.

The contract, the three renderers and every check that asserts `list`/`listitem` move together. The
computed role is what the assertions read, so this is visible to them rather than silent.

**This does not fix what a reader says, only what it can reach.** The keyboard arriving is a
precondition for the strip being usable, not the same thing as it.

## Alternatives rejected

**`listbox`/`option`.** Switches too, and ADR 0138 rejected it for a reason that still stands and is
its own: **this widget's listbox is the popup**, the place a person chooses from. A strip of what has
*already* been chosen is not a second selection widget, and declaring it one puts two listboxes in a
control that has one. An `option` also may not contain buttons, and a chip contains up to five.

**Keep `list`/`listitem` and record the loss.** Honest, and it costs nothing today. Rejected because
the loss is not a limitation a person can work around: two people with the same screen reader get
different controls depending on how they arrived, and neither is told.

**`tree`, `menubar`, `tablist`.** They switch as well and each promises something this strip is not.

## Verification

`a-position-the-attribute-claims.spec.ts` asserts the computed role of the chip and of the strip, from
the accessibility tree rather than from the markup. It is written against `list`/`listitem` and must
be moved to this record's pair; until it is, it is a known failure stating the decision it predates.

The spec the outside view's finding produced asserts that the focused chip's role is one a browsing
reader's mode switches on. It is red today and green under this record.

**The cells have no `row` between them and the grid, and that is a departure.** ARIA structures a grid
as `grid` → `row` → `gridcell`, and this strip is one row of cells with no row element. Measured from
the computed tree in Chromium, all three renderers: `grid` with `gridcell` children, none of them
ignored — so that engine builds the relationship without the intermediate node. **Only that engine has
been measured.** A renderer of a stricter tree could drop the cells, which would be worse than the
`listitem` this replaces, and the honest statement is that adding the row is the safe move and has not
been taken because the measurement did not demand it.

**What no check here can establish:** that a screen reader actually switches, and that the arrows then
do what this repository believes. The role table is published practice; the behaviour is inferred from
it. No assistive technology has been run against this library — see the closing note of ADR 0145, which
records the same boundary for the same reason.

## Security and privacy

None. A role changes how a control is announced and navigated; it stores nothing, sends nothing, and
exposes no value that was not already on screen.
