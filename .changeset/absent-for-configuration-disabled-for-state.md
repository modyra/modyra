---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
"@modyra/styles": minor
---

Absent for configuration, disabled for state

A control that a field's design includes is now drawn whether or not it can act at this moment.
`multiselect.clearAll`, `multiselect.wayBackAction` and `file.clear` were declared present only while
they had something to do, so they arrived and left under the hands of whoever was aiming at the
control beside them — and the two multiselect neighbours are undo and discard-everything. They are
required parts now, carrying a `disabled` state, `aria-disabled` and a `--disabled` class: in the
page, in the tab order and in the accessibility tree at all times, announced as unavailable, refused
when pressed.

Breaking: `undoIsOnOffer` is gone from `MdyPartPresence`. It expressed "draw this only while an undo
exists", which is the rule this release reverses. A consumer reading it for its own presence
decision should read the part's `disabled` state instead, or `MDY_ARIA_DISABLED_PARTS`, which names
the parts that answer unavailability this way.

The conformance kit gains the issue code `PART_HIDDEN`: one of those parts found with a `hidden`
attribute, or without `aria-disabled`, is now a violation. A consumer matching exhaustively on
`MdyDomContractIssueCode` gains a case.
