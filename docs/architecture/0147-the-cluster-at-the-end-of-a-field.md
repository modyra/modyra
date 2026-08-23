# ADR 0147: The cluster at the end of a field

Status: Accepted

Supersedes [ADR 0144](0144-a-slot-that-is-always-there.md).

## Context

ADR 0144 put the one way back on a row beneath the field, and reserved that row's line so nothing
moved when the offer arrived. It rejected putting the offer inside the control for a stated reason:
*"the clear-all and the caret would slide sideways as it arrived, trading the vertical shift for a
horizontal one."*

**That reason has an answer the record did not consider: reserve the slot in the cluster too.** If the
undo's place at the trailing edge is held whether or not anything is offered, nothing slides in either
direction, and the objection that sent the offer a thousand pixels away stops applying.

Measured on what ships today, identical in all three renderers, on a field showing an undo offer:

```
caret        16×16   at x=1144        under the 24px a stacked control needs
clear-all    28×56   at x=1160        0px between it and the caret
undo         31×17   at x=93, y=88    its own row, ~1050px from the controls it belongs with
order along the edge:  caret · clear-all — the destructive one on the outside
```

Three separate problems in one place. The caret is below the floor `DESIGN.md` documents for a stacked
control. **There is no gap at all between a control that opens a list and a control that empties the
field** — a thumb that misses the first hits the second, and the second is destructive. And the way
back to what was just deleted is at the other end of the field, on a row of its own, so the two acts —
*undo* and *clear everything* — are as far apart as the layout allows while being each other's
opposite.

The outside view was asked how a cluster of small controls at the end of a field should be arranged.
Its answer is the decision below; it does not know this repository and was not told what the
implementation would cost.

## Decision

**The undo joins the cluster at the field's trailing edge, and the cluster is arranged so a thumb can
tell its members apart.**

```
↶            ✕              ⌄
undo         clear all      open
```

- **Each control is at least 24×24**, which is the floor `DESIGN.md` already documents for a stacked
  control and which the caret was below.
- **The undo's slot is reserved**: `✕` and `⌄` sit where they sit whether or not an undo is on offer,
  so nothing moves along either axis. That is ADR 0144's property, kept, and applied to the axis that
  record used as its reason for placing the row elsewhere.
- **The gap between `↶` and `✕` is visibly wider than the gap between `✕` and `⌄`.** The destructive
  control is separated from the one that reverses it; the two that merely open and close things sit
  together. A gap of zero, which is what ships, is the arrangement that makes a missed press
  destructive.
- **The undo names what it undoes**: `aria-label="Undo remove Alfa"`, not "Undo".
- **`Ctrl`/`Cmd`+Z** reaches it from the keyboard, and **there is no timeout** — the offer stands
  until it is used or another act replaces it, which is ADR 0144's WCAG 2.2.1 reasoning and is not
  changed by moving where it stands.

The row beneath the field goes. The band it reserved returns to the validation message, which ADR 0144
noted it was competing with.

## Consequences

**The contract moves with it.** `wayBackAction` becomes a member of the box rather than of a row under
the root, and `wayBack` — the row — stops existing as a part. Three renderers build it, so this is a
public contract change and ships as one.

Every field with a trailing cluster gets wider by the reserved slot, on every kind that has an undo.
That is the cost ADR 0144 paid vertically, paid horizontally instead, and it buys the two acts being
next to each other.

**A 16×16 caret becomes 24×24 in every theme.** The caret is the most-drawn affordance in the library,
so this is a visible change on every select, multiselect, and picker, and the screenshot baselines
move with it.

The offer is no longer a sentence. *"Removed Alfa — Undo"* said what happened in words; a mark in a
cluster says it in a name only a screen reader reads. **What a sighted person loses is the statement
that something was removed at all**, and that is the strongest argument against this record. It is
mitigated by the mark appearing where it did not exist a moment ago — an arrival in a reserved slot is
a change a person can see — and it is not the same thing.

## Alternatives rejected

**Keep ADR 0144's row and only fix the cluster's sizes and gaps.** Cheapest, and it leaves undo and
clear-all a thousand pixels apart while being each other's opposite. The distance is the defect, not
just the geometry.

**Put the undo in the cluster without reserving its slot.** This is what ADR 0144 rejected and it was
right to: `✕` and `⌄` would move under a person's thumb as the offer arrived, which is worse than a
row appearing below where nothing was pointed.

**Both — a mark in the cluster and the sentence below.** Two affordances for one act, and the sentence
brings back the reflow the reserved row was invented to stop.

## Verification

`battle-tests/browser/a-cluster-a-thumb-can-tell-apart.spec.ts` measures the sizes, the order and the
two gaps in all three renderers, and is red today against the geometry above.

`nothing-below-a-field-moves-when-a-value-goes.spec.ts` asserted ADR 0144's property and must be read
again under this record: with no row beneath the field there is nothing to reserve, and the assertion
it makes about the trailing controls not sliding sideways is the one that survives — it now covers the
reserved slot instead of the reserved line.

**Not verified, and it is half of this decision: the 4.5:1 contrast floor on the undo mark.** The
contrast tool in this repository samples painted pixels and is solid over a filled region; it is not
validated over a thin stroke, which is exactly what an icon drawn as a stroke is. Producing a number
from it here would be inventing one. That check needs an instrument this suite does not have.

## Security and privacy

None. The undo reverses an act on data the person entered and is looking at; where it is drawn changes
nothing about what is stored or sent. The accessible name repeats a value already on screen.
