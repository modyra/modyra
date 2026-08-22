---
"@modyra/widgets": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A quantity a keyboard can change, and a × at the end of the chip

`ArrowUp` and `ArrowDown` on a counter chip stopped stepping its quantity. The ± controls beside the
number are `tabindex="-1"` pointer affordances, so with those two keys gone the number was reachable
by pointer and by nothing else — WCAG 2.1.1, and not a cost ADR 0138 traded for taking the
`spinbutton` role off the chip: that record gave up the native announcement and kept the keys.

The binding is back in the table and the handler in all three renderers. It collides with nothing: the
strip's own arrows are left and right, and the `open` bindings now name the part they open from.

The catalogue also declared `chipRemove` before `chipMove`, so the part order it published put the ×
in the middle of the chip while all three renderers draw it at the trailing edge, where it belongs.
The declaration follows the renderers.
