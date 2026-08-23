---
"@modyra/styles": patch
---

A chip's ceiling is the strip it sits in, not a constant.

A value chip was capped at 12rem, and a second cap of 11rem sat on the base chip. Both are constants,
so a label was cut while three quarters of the field around it was unused — and a label cut to a few
characters renders two different values identically, which is the strip no longer saying which one was
chosen. Bounded by its container instead, a chip is shortened only when one value really is wider than
the room there is, and the strip scrolls before that.

`--mdy-chip-max-width` is gone from the base and from the material and iOS themes: a theme that set it
was setting a constant this rule no longer has.
