---
"@modyra/styles": patch
---

A switch that is on no longer looks unavailable

The themes reached a switch's state through `.mdy-toggle:has(input:disabled)` — any input inside the
switch. That was correct while a switch held one input. It now holds two: the hidden companion that
makes a boolean submit as `false`, and that companion is disabled **exactly while the box is ticked**.

So a switch that was on was painted with the treatment for one that cannot be used: pale track, grey
thumb, `opacity: 0.5`, across four themes.

The rules now name the switch's own control — `.mdy-toggle__control` — as the checkbox rules beside
them already did. Nothing else moves: a genuinely disabled switch still gets the disabled treatment,
verified by forcing it.

**If you wrote a theme rule that reaches a control with a bare `input` selector, it now has two
elements to choose between.** `.mdy-toggle__control`, `.mdy-checkbox__control` and the other part
classes name the one a person sees.
