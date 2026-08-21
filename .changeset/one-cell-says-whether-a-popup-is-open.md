---
"@modyra/angular": minor
---

A popup closes when its field leaves play

A field can leave play while its popup is open, and nobody has to click anything for it: a sibling's
`when` predicate takes it out when a value arrives from a fetch. The widget contract has a rule for
that — the popup goes — and Angular did not follow it. The dial stayed drawn and the opener kept
announcing itself expanded, while `aria-disabled="true"` correctly reached the control: the field was
visibly out of play and still offering something whose clicks correctly did not land.

The rule was never missing. It writes the controller's `open`, and this renderer painted a cell of
its own. `MdyOverlayControl` now reads and writes through whichever cell the kind's controller owns,
and keeps a local one only for a kind that has no controller.

Converted: **timepicker** and **multiselect**. Not converted, and stated rather than left to be
found: **datepicker** and **daterange** drop the `restore-focus` command their controller returns, so
routing their writes through it fails the canonical after-Escape comparison; **colors** adopts no
controller in this renderer at all. Those three keep the old behaviour for now.

ADR 0118 records the decision, including why `open()` is a method rather than a `computed`.
