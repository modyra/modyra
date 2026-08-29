---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A panel belongs to its field, and closing one is an answer

Two rules ADR 0167 decided and left unbuilt.

**A field's focus scope is the control and the panel it opened**, wherever that panel is drawn.
`focusIsInsideField` reads the opener's `aria-controls` and answers for the panel it names; three
renderers answered by containment before, so a panel portalled out of its field to escape a
scrolling ancestor read as "focus has left" while an in-place one read as "still here" — one
contract, two behaviours, decided by where a `<div>` was appended.

**Opening a panel and closing it without choosing marks the field answered** — the panel's version
of typing and deleting: the person saw what was on offer and took none of it. Touched and not dirty,
because nothing about the value changed. This is what makes the previous release's rule complete: a
bare traversal says nothing, and a gesture that engaged the value space does.

Two renderers were told about every close except the one a person actually makes: Angular's Escape
went straight to the overlay lifecycle, past the door a component overrides, and lit's colour palette
flipped its own flag without telling its controller. Both now close through the contract.

The canonical after-Escape expectation changes with it: the state is the resting one plus `touched`.
