# ADR 0212: What a calendar is called

Status: Accepted

## Context

A date field opens a panel. Inside it a heading says which month is showing, and under the heading a
grid of days is walked with the arrow keys. Somebody using a screen reader is told the name of the
grid on entering it, and the name of the panel on opening it. Both roles are among those that must be
named.

The renderers disagreed, and each disagreed differently. Measured on one document, with the panel
open:

    plain      grid: aria-label "September 2026"  and  aria-labelledby → the field's caption
    lit        grid: aria-label "September 2026"
    angular    grid: aria-label "September 2026"
    vue        grid: aria-labelledby → the field's caption      panel: no name at all

Two questions are tangled here and they have different answers: **what** the grid is called, and
**how** the name is attached.

The second is not a matter of taste. `aria-labelledby` wins over `aria-label` in the accessible-name
computation — always, not sometimes — so where both are written the caption a renderer took the
trouble to compute reaches nobody while looking correct in the markup. That is what plain was doing:
computing the month and announcing the field.

## Decision

**The grid is named by the month it is showing, and named by referring to the visible heading** —
one copy of the text on the page, not a written caption repeating it. The month a reader hears is the
month a reader sees, and moving to the next month changes both together.

**The panel is named by the field it serves.** A person arriving there needs to know what they are
filling in; the panel is not a month, it is the place where a date gets chosen.

**Never two channels on one element.** Where a reference exists, no written label sits beside it.

Where a range draws a grid per month, each grid says its own month. Which end of the range is being
chosen is the surrounding context's business, not the grid's name.

## Consequences

The heading has to be a referable element whose own accessible name is the month, which is a real
constraint on the markup and not a formality: in one renderer the month text lives **inside the
button that switches to the year view**, and that button carries its own name ("change view,
currently September 2026"). Referring to it would name the grid with the button's name — the same
class of defect as ADR 0212's own motivation, one layer along. That renderer needs a text-only
element inside the button to carry the reference. One renderer draws no heading element at all and
needs one.

Until every renderer carries the referenced id, the reference must not be published: a grid pointing
at an id nothing carries is named by nothing, which is worse than being named by the wrong thing. The
projection change and the renderers' adoption therefore land together.

## Alternatives rejected

**Name the grid after the field.** Defensible on its face — it is what two renderers already did, and
a grid named "Date of birth" tells you what you are filling in. Rejected because it does not identify
*this* grid: everything under the cursor changes when the month moves and the name does not, so the
name answers a question the person did not ask and withholds the one they did. The heading already
carries the answer.

**Keep a written `aria-label` with the month.** It produces the right words today and it is one
attribute instead of a reference plus an id. Rejected because it is a second copy of text that is
already on screen: the two can drift, and nothing would notice — and where a reference is also
present the written one silently loses.

## Verification

`packages/widgets/test/a-name-that-crosses-into-a-control.spec.mjs` holds the rule that made the
attached defect visible: no part is named by pointing at a control that answers with its value, with
the roles derived from the projection rather than listed.

The name a platform actually computes is not observable in a DOM stand-in — an assertion over
attributes is true in every renderer and blind in all of them. The binding half of this record is
therefore the browser tier, which reads the accessibility tree the way a platform builds it, and
which is where the defect this record settles was found.

## Security and privacy

None. The decision moves where a name is read from and changes no data, no storage and no boundary.
