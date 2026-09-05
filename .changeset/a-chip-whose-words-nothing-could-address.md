---
"@modyra/vue": patch
---

A chip's words carry the class that lets them be truncated

At 320px a multiselect holding a dozen values grew a horizontal axis: the row was capped at its own
width and its contents were not, so the chips reached past it. The rule that truncates a chip's label
on a narrow screen was already written — and it never matched, because this renderer drew the words
as a bare `<span>` with no class at all.

Nothing could address them: not the stylesheet, not a probe, not a theme wanting to style a value's
name. The label now carries `MDY_CHIP_CLASSES.label`, the same vocabulary every other renderer uses.

Measured at 320px with the twelve long labels the tier uses: overhang 21px before, **0 after**, with
the button that removes a value and the handle that moves it both at full size.

The species is the one this repository keeps finding: a renderer that redecides, or forgets, what the
contract already says. It is invisible until something depends on the class — here a width, elsewhere
a probe.
