---
"@modyra/styles": patch
---

A chip is one height, and the affordance column does not bend around one kind.

Two more values left off the control scale by the same half-migration:

- **A chip was 28 in the field and 32 in the popup.** The value chip moved onto `control-1`; the chip
  a person picks from did not, so one control was two heights depending on where they were looking at
  it. Both are `control-1` now, including the counter variant that carries its own height so its step
  buttons have something to be 100% of.
- **The clear-all was 44 wide** where every other trailing affordance is 28, so its centre sat 8px
  further in and the column bent around one kind. Its width is a control step; its 44px pointer target
  is the overlay it already carries, which needs no width from the box.
