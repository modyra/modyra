# ADR 0172: The trailing column carries one thing

Status: Superseded by ADR 0173

Supersedes [ADR 0147](0147-the-cluster-at-the-end-of-a-field.md).

## Context

ADR 0147 put three controls side by side at the trailing edge of a multiselect: the way back, the
clear-all, and the mark that opens the field. It solved a real defect — undo was a thousand pixels
from the act it reversed — and it solved it by moving undo to where the other two already stood.

ADR 0171 then made the two commands permanent: drawn whether or not they can act, dimmed when they
cannot. That is when the arrangement became measurable as what it is. The field now spends roughly
96px of its trailing edge on three affordances, and it is the only kind that does. Six other kinds
put one thing there, always the same thing: the control that opens the field.

The outside view was asked what a person scanning a form relies on at that edge, and whether a
single-column alignment is a need or a designer's preference. Its answer reverses the placement it
gave for ADR 0147, with its reason:

> A constant position is what lets a person operate without reading. Under magnification it is worth
> more — someone at 400% sees a window a few fields tall, and the trailing column is one of two
> anchors that say they are still in the same form. A dimmed control in that column says "here is how
> you *sometimes* operate this field", which dilutes the one signal the column carries.

## Decision

**The trailing column holds one affordance on every kind: the one that opens the field. Commands
about the value stand with the value.**

```
[ chip  chip  chip ]   ↶      ✕                      ⌄
  what the field holds  undo   clear all              open
  ────────────────────────────────────                ──
  the value and the commands about it                 the column
```

- The two commands sit after the chips and before the trigger, which is the end of the selection and
  the start of the free space. That is also where a person's attention is when they need them —
  immediately after removing a chip.
- Each is square at `--mdy-affordance-target-stacked`, the 24px floor `DESIGN.md` documents, rather
  than the trailing column's width. Taking the column's width is what put them in the column.
- The gap between the way back and the clear-all it reverses stays: a thumb aimed at one must not
  land on the other.
- ADR 0147's property survives untouched. Nothing slides as an offer arrives, because after ADR 0171
  nothing arrives — both controls are always drawn.
- ADR 0171 is unchanged: present and disabled is still the answer to *whether a control exists*. This
  record answers *where*, which is a different question, and the answer there is: not in the line
  reserved for what every field has.

**A button whose whole visible content is a mark is named by its action, and the mark is hidden from
the accessibility tree.** `×`, `↶` and `⌄` are drawings that happen to be made of characters. The
success criterion about visible text in the accessible name is written for text a person can read as
a word, and nobody says "click multiplication sign", so it does not bite — but the voice user's
problem does not go away with it. Each such control carries a `title` with the same words as its
name, which gives them something to say. Left in the tree, the mark makes a reader announce
"multiplication sign, clear selection".

## Consequences

**The contract's reading order changes**, which is a public change and ships as one:
`chips`, `overflowCount`, `wayBackAction`, `clearAll`, `trigger`, `arrow`. Keyboard order follows it,
so Tab now reaches undo and clear-all before the control that opens the list — which is the order they
are read in and the order they are drawn in.

**The field's trailing edge loses about 60px of controls**, so a multiselect lines up with every other
kind again and the screenshot baselines move.

The strongest argument against this record is that it moves two controls a person may have learned
where to find, for a reason none of them will ever articulate. That is the cost of a column: it is
worth what it is worth only because it is the same everywhere, and the exception is what it costs.

## Alternatives rejected

**Keep the row and shrink it.** The objection is the column, not the width. Three small things in a
line reserved for one still break the line.

**Move only the undo and leave the clear-all in the column.** The clear-all is the more destructive of
the two and the one that is unavailable more often. Leaving the sometimes-dimmed destructive control
in the invariant column keeps the defect and splits the pair that belongs together.

**Put the commands inside the popup.** They act on what the field holds, which is visible with the
popup closed; a command reachable only after opening something is a command a person does not find.

## Verification

`npm run test:conformance` fails on the part order in any renderer that keeps the old arrangement —
`PART_ORDER`, derived from the contract rather than from a copy of it. Restoring one renderer to the
row of three is red.

`npm run contract:diff` classifies the reading-order move as major; the snapshot records `order` since
the tooling batch, so a part changing position cannot ship silently.

Not covered here: the geometry — the 24px floor and the gap between the two commands — is a
browser-tier measurement, and this record does not claim it has been made.

## Security and privacy

No impact. The change is placement, tab order and two tooltips; no data crosses a boundary it did not
cross before, and no control gains an act it did not have.
