---
"@modyra/widgets": patch
---

The datepicker, date range and segmented control are proven from the keyboard.

Six more behaviours run against a real browser: each calendar opens from a key press, dismisses
without stranding focus, and moves through its grid with the arrows; the segmented control's
`role="radiogroup"` is held to meaning something — the arrows must actually move the selection.

**All three passed on first contact**, which is the point of writing the tests: their keyboard
policies already lived in the contract (`calendarKeyboardTarget`, `optionNavigationIndex`) rather
than in a renderer's handler, so there was nothing to fix — only something to prove. Removing the
segmented control's navigation now fails a test; before this, nothing asked.
