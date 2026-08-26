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

**The 4.5:1 contrast floor on the undo mark is checkable, under one condition.** See the amendment
below; the paragraph this replaced said the instrument did not exist, and it was wrong within the
hour.


## Amendment: the limit was never the stroke's weight

This record shipped saying the contrast floor on the undo mark could not be checked, because the
repository's contrast tool samples painted pixels and had never been validated over a thin stroke.
That sentence was inherited from the finding that prompted it and **it was certified false an hour
later** — `battle-tests/harness/a-ratio-a-thin-mark-can-carry.test.mjs`, which synthesises marks of a
known ink on a known background so that *measured equals calculated* is a statement about the
instrument rather than about a browser.

```
ink 44,25,61 on white — calculated 15.99:1

4px · 2px · 1px on the pixel grid       15.99:1     the ink exactly
1px across a half-pixel boundary         3.21:1     two columns at half coverage
0.5px                                    3.21:1
0.25px                                   1.68:1
```

**The same one-pixel stroke reads 15.99 or 3.21 depending on where its edge falls**, so no rule about
weight can express the limit. What the instrument needs is **one fully opaque pixel**, which makes the
condition one about capture rather than about design: **read the contrast at a device pixel ratio of 2
or more.** At `deviceScaleFactor: 3` a 1px CSS stroke becomes three device pixels and its interior is
opaque however it is aligned.

It also explains the anomaly the original warning came from — a minus at 2.98:1 beside a plus at
6.78:1, in one control, in one colour. Two subpixel alignments, one ink.

**What is certified and what is inferred, kept apart.** The certification is synthetic: it proves the
tool computes the right ratio from given pixels. That a browser's rasteriser produces opaque interiors
at DPR 2–3 is the inference on top, and it is reasoning rather than a rendered measurement. The floor
is therefore checkable, and the first run against a real capture is still the one that has not
happened.

## Security and privacy

None. The undo reverses an act on data the person entered and is looking at; where it is drawn changes
nothing about what is stored or sent. The accessible name repeats a value already on screen.

## Amendment: the caret is not one of the controls

This record counted three controls at the trailing edge and gave all three a size and a place in an
order. **Two of those three are controls. The caret is a drawing**, and the difference decides both
the cost of this decision and the shape of what ships.

The catalogue already declares which part opens the list — `opener: "trigger"` — with the reason
beside it: *the whole control opens the popup, and a magnifier beside the field made the opener a
decoration rather than the control.* The stylesheet says the same of the caret's box: *the glyph's
box, not a target's*, and it is `pointer-events: none`. The outside view, asked in ordinary words and
told nothing of this repository, reconstructed the same thing: a caret that were a control would be a
second name, a second keyboard stop and a second voice for a gesture that already has one, and

> *a mark has no minimum size, because the rule sizes what is pressed, and here what is pressed is
> the whole field.*

Two consequences, and the expensive one is withdrawn.

**"A 16×16 caret becomes 24×24 in every theme… and the screenshot baselines move with it" does not
follow.** The caret keeps its glyph box. The baselines do not move for it, and a change that moves
hundreds of them is evidence that something else was touched.

**Only the commands are in an order**, so the order this record asked for — the way back, then the
clear-all, then the opener — is an order of two, and the caret is drawn last because that is where a
person looks for it. There is no structural choice to make between the order and the wide press area
that opens the list: both are kept, and the caret is painted by the box at its own trailing edge
rather than by the control that opens.

**The gap is kept and its reason is corrected.** No published rule requires it: the target-size
criterion sizes a target and treats surrounding space only as a way to rescue one that is too small,
and these are large enough already. Recorded as conformance it would be a false claim. It is here
because **the way back is the remedy for the clear-all** — it is what allows a control to discard
everything without stopping to ask — which ties the two together and pulls them apart at once: near
enough to find in the moment after the mistake, far enough that a thumb aimed at one cannot land on
the other. The way back comes first for a second reason of the same kind: arriving, it grows into the
empty space instead of pushing the destructive control sideways under a thumb already aimed at it.

**The sentence was two jobs, not one label.** *"Alfa removed — Undo"* both said what had happened and
offered the way back. The mark can do the second and cannot do the first for anybody: a person who
does not see it perceives no arrival at all, and a person who does was looking at the chip that
vanished — which is itself the confirmation, and a better one. So the announcement goes to the live
region, which owes it whether or not a way back is on offer, and **the act goes into the control's
name**.

The name is composed from the same three templates the sentence uses rather than from wordings of its
own — one reversal covers a removal, a move and a clear, and a name built around *restore* is wrong
for the middle one.

### What is not decided here

The help text and the error message share one region below a field, and the outside view is that they
must **coexist** — the instruction is most useful in the moment the error appears, so replacing it
with the error withdraws the remedy exactly when it is needed. That is a change to every kind's shell
and a separate decision; it is recorded as owed, not taken.

## Verification of the amendment

`packages/widgets/test/affordance.spec.mjs` asserts the trailing set for every kind, including that
the caret remains the only decorative member of it. `packages/widgets/test/icons.spec.mjs` measures
the mark against the icon grid.

The claim that the baselines do not move is itself the check: a screenshot run that moves hundreds of
images falsifies this amendment rather than confirming the change.

## Security and privacy of the amendment

None. Nothing here changes what is stored, sent or exposed; the accessible name repeats a value the
person entered and can see.
