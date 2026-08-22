---
"@modyra/widgets": minor
"@modyra/angular": patch
---

One gesture, one answer

The same three keystrokes on the same document reached different values depending on which adapter
drew the page — the failure a cross-framework UI contract exists to prevent. Three controls, three
causes, all of them a renderer or a controller disagreeing with a rule the contract had already
written down.

**A select's list opened with the first option already under the reading position** in the two
renderers built on the select controller, so the first `ArrowDown` stepped past it while Angular's
arrived at it. The keyboard policy beside that controller says the opposite in words — *the list opens
with nothing active, and the next arrow lands where the direction says* — and with the first option
pre-activated, `listboxNextIndex`'s answers from nothing-active could never run. Opening now puts the
position on the chosen option, and nowhere when nothing is chosen.

**Angular's datepicker opened on no key at all** and its timepicker on `ArrowDown` alone, while both
open on `Enter` everywhere else — two sibling controls in one adapter disagreeing with each other. The
overlay base now reads which keys open a kind from `MDY_WIDGET_KEYBOARD`, so a binding gained upstream
reaches every control that inherits it.

**Angular's clock did not commit on `Enter`**, which the table declares for an open timepicker, so a
time set from the keyboard could only be confirmed with a pointer.
