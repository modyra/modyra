# ADR 0131: A rectangle outside a box is not a clipped one

Status: Accepted

Supersedes [ADR 0130](0130-a-popup-outlives-the-box-it-opens-from.md).

## Context

ADR 0130 decided that a popup must be rendered outside the field it opens from, and gave one reason: a
measurement showing that two renderers of three had their option list cut in half by an ordinary
scrolling container. **The measurement was wrong, and the record built on it was wrong with it.**

What it did was compare the list's rectangle against the ancestor's rectangle and call the difference
"cut off". Two facts it never checked undo it:

- **every renderer's popup is `position: fixed`.** A fixed element is not clipped by an ancestor's
  `overflow` at all. All three escape the scroller; none was ever cut off by it.
- **one renderer's option list is its own scrollport** — 104 pixels of 200. Its last option sits below
  the list's own bottom edge because it has not been scrolled to. An option a person has not scrolled
  to is not an option that has been taken away.

Asked the question a person asks — *press where the last option is drawn; what gets it?* — with the
option first brought into view the way a keyboard brings it, all three renderers hand back the option,
under a scrolling ancestor, a transformed one and a `contain: paint` one alike. Nine cases, nine
passes.

## Decision

**ADR 0130 is withdrawn. Where a renderer puts its popup in the DOM is not decided by this project,
and no renderer is required to change.**

What is required is the property, and it is now checked rather than assumed: an option list must remain
**reachable** inside the containers a consumer supplies — one that scrolls, one that is transformed,
one that paints under `contain`. How a renderer achieves that is its own affair; `position: fixed`
plus a portal and `position: fixed` inside the component both satisfy it today.

The DOM asymmetry that started this is real and stays recorded as finding 374 at its original severity:
Angular keeps its popup in the component's subtree, plain portals to the body, lit places it in an
overlay panel inside the field. It changes what "scope a query to the control" means, which cost three
arguments across two sessions. That is a cost worth removing, and it is **not** a conformance defect
and not an S1.

## Consequences

The battle written for 0130 keeps its place and changes its meaning: nine green cases pinning that a
popup survives three kinds of ancestor. It was written to prove a defect and it documents a property —
which is the better of the two outcomes, and the only one available once the defect turned out not to
exist.

Anyone reading 0130 finds the reasoning that was wrong and the measurement that made it look right.
That is why it is superseded rather than edited: a record deleted teaches nothing, and this one is the
clearest example in the archive of a decision reached from geometry that nobody hit-tested.

## Alternatives rejected

**Edit 0130 to say what is true now.** Forbidden by this project's own rule and wrong here for a
sharper reason: 0130's error is the interesting part. A reader who finds only the correction learns
that popups are fine; a reader who finds both learns how a plausible measurement produced a false
architecture decision inside an hour.

**Keep 0130 and require the portal anyway**, on the grounds that a DOM asymmetry is worth removing.
Rejected because it would be a real decision resting on a stated reason that is false, and the honest
version of that argument — three renderers should answer one way — is available without inventing a
defect for it. If the portal is wanted, it is wanted for the scoping cost, and that case can be made on
its own.

## Verification

`a-list-a-scrolling-box-cuts-in-half.spec.ts` — nine cases, three renderers by three ancestors. Green.
It brings the last option into view before hit-testing it, because the version that did not called a
list's own scroll position a clipped list and produced this record's mistake.

The check that fails if the property is lost: a renderer that stops using `position: fixed` for its
popup, or a consumer container this suite does not model. The three ancestors here are the ones that
change what an overlay can do — `overflow` clips, `transform` makes a containing block that fixed
cannot escape, `contain` does both — and a fourth would be a new case rather than a variation.

## Amendment: the reason is stronger than the one recorded

This record said every popup is `position: fixed`, which an ancestor's `overflow` does not clip. That
is true and it is not the whole reason. Measured while mutation-testing the battle: the option list
sits inside a `[popover]` or `<dialog>`, so **it is in the top layer**.

The difference matters because the three ancestors this project models are not equally survivable by a
fixed element. `overflow` does not clip a fixed box, but `transform`, `filter` and `contain` each make
a containing block that a fixed descendant *cannot* escape — so "it is fixed" would predict that the
transformed and contained cases fail, and they do not. The top layer is outside the ancestor chain
entirely, which is why all nine cases pass rather than three of nine.

The mutation that established it is worth keeping too, because two before it were invalid and looked
conclusive: covering the popup with an opaque `position: fixed` sheet at `z-index: 99999` did **not**
make the option unreachable, and neither did moving the popup back inside the field — the first
because nothing in normal flow can cover the top layer, the second because moving the node made the
renderer drop it. The mutation that bit was hiding the option itself, which is the only one of the
three that changed what a press would get without changing anything else.

## Security and privacy

No impact.
