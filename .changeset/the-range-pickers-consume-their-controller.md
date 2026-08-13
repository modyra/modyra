---
"@modyra/widgets": major
"@modyra/lit": minor
"@modyra/angular": minor
---

Both remaining range pickers consume the controller for their kind

Each held the whole of what a range means in its own state — the draft, the
preview that follows the pointer, which pick opens the range and which closes it,
the month on screen, the focused cell, the view — and decided every one of them
for itself. The framework-free renderer had already stopped; these two were
waiting on the view mode reaching the contract, and on the modal variant giving
up its draft.

The Lit component sheds nine reactive properties and subscribes through
`subscribeController`, which existed for exactly this and had no consumer. The
Angular calendar takes the controller as an input and keeps its own signals only
for the standalone case, since it is public and mountable without a form.

`MdyDaterangeFieldController` gains `setBounds`, the twin of the datepicker's:
bounds move when a return date cannot precede a departure, and rebuilding the
controller to carry that would forget the month on screen and which end the next
pick closes.

Intra-package duplication falls from 18 pairs to 11 — the seven that go are the
calendar navigation each renderer had written twice, once for its date picker and
once for the range picker copied from it.
