---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

One row, one arithmetic

The colour presets' roving index was written three times, once per renderer — three chances for one of
them to clamp where the others wrap. `rowRovingIndex` is published from `@modyra/widgets` and all
three call it: either axis walks the row, `Home` and `End` reach its ends, it clamps rather than
wraps, and the direction comes from the binding so a right-to-left document reads correctly.

Angular also lands on a swatch now. Its panel is a popover, and the frame the focus was attempted in
was the one before the popover was shown — a `focus()` there is a no-op that reports nothing, so the
keyboard stayed on the toggle and the arrows had nothing to move. The attempt is checked and retried
rather than assumed.
