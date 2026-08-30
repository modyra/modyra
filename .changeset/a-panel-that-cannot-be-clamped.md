---
"@modyra/lit": patch
---

A panel that cannot be clamped is not docked

`anchorOverlay` decides differently when neither side holds the panel: content that scrolls takes the
roomier side and scrolls there — that is what a long list is for — and content that does not has one
size, so a side that cannot hold it is not a placement at all and the panel centres.

lit built the policy's options field by field and left `scrolls` out, so every panel was treated as
scrollable. A clock 471px tall was docked under a field with four hundred pixels beneath it and
clamped to 419 — the stub of itself that not scrolling means it cannot be. The catalogue had declared
`scrolls: false` for the kind all along; nothing carried it across.

The policy was right throughout. This is one field reaching it.
