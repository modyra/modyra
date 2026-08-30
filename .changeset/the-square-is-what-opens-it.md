---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

The filled square is what opens a colours panel, and the caret beside it is a drawing

The small square filled with the current colour is the most recognisable element on a colours field:
every platform ships one and everybody has pressed one. What it did differed by renderer — two
opened the field's panel of ready colours, one opened the platform's own chooser — so an application
that changed renderer changed what that square does, from a document that says nothing on the matter.

**The square is now the opener everywhere**, and the panel it opens carries a route on to any colour
at all. The caret at the end of the field opened that same panel, which made one act into two
commands: two accessible names, two stops in the keyboard walk, two things to describe. It is now a
drawing — out of the tab order *and* out of the tree assistive technology reads, never one without
the other — while still answering a press, because the area sits inside the field and a dead patch
inside a live control reads as a fault.

**Migration.** The published relationship `toggle[aria-controls] → popup` is replaced by
`nativePicker[aria-controls] → popup`, and `MDY_POPUP_OPENERS.colors.opener` is `nativePicker`. Code
that located the opener by the caret's part name should ask the catalogue instead — the opener has
been declared there all along. A renderer that draws its own colours field should move the panel's
handler and its `aria-controls` onto the square, and stop giving the caret a name, a role and a
keyboard stop.

The decision and the alternatives that lost are ADR 0159; ADR 0158 carries an amendment recording why
the preview square and the door to every colour are necessarily two elements.
