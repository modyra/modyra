---
"@modyra/widgets": minor
"@modyra/angular": patch
---

Focus that waits for the panel it is aimed at

A popup rendered into the top layer exists in the document a frame before it is shown, and `focus()`
on an element that is not being rendered is a no-op that reports nothing. A renderer focusing on the
render it triggered therefore left the keyboard where it was — which is how Angular's colour palette
took focus in its unit tests and not on a page.

`focusWhenShown` verifies the attempt and retries on the next frame while the caller says the reason
still holds, bounded rather than looping: a panel that never draws is a different defect and an
endless retry would hide it.
