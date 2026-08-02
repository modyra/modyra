---
"@modyra/styles": patch
---

A field's inner padding follows the writing direction.

`.mdy-input-wrapper__inliner` set `padding: 0 0.25rem 0 0.75rem` — more room where the text starts
than where the affixes sit, which is right, written physically, which is not. Under `dir="rtl"` the
8px difference stayed on the left, so everything at the field's inline end — the colour picker's
toggle, and anything else living there — sat 8px inside where it belonged.

Measured rather than eyeballed: the RTL fixture put the colour toggle 189px from the inline start in
LTR and 181px in RTL. **All sixteen measured families now mirror**, and the fixture's ledger is empty.

The floating-label variant's `padding-left` is logical for the same reason.
