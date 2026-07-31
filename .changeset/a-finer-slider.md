---
"@modyra/styles": minor
---

A finer slider, and a focus indicator it never had

Reported as reading chunky. A 20px handle on a 4px rail is M3's proportion, and a column of them
reads as a row of knobs on a rail they barely touch. The **Modern** theme inverts the emphasis: a
6px track so the filled part is legible, a 16px handle that sits on it rather than straddling it,
and a growth on hover and press so it answers the pointer. Material and iOS keep their own faces —
none of them is the base of another.

**The slider gains a visible focus indicator.** The foundation sets `outline: none` on the control
and leaves the indicator to the theme; Modern supplied none, so the control could be tabbed to with
nothing on screen to say so. It now draws a halo around the handle — a ring rather than an outline
around the rail, which would trace a band the full width of the form and say nothing about where the
handle is. It is a shape change, so it does not depend on colour alone, and it survives
`prefers-reduced-motion`, which drops the growth but never the indicator.

Nothing here restates a foundation rule: the sizes are `--mdy-slider-*` on the container, and the
fill stop already reads `--mdy-slider-thumb-size`, so shrinking the handle keeps the fill under its
centre with no arithmetic anywhere. Measured across four stylesheets at the minimum, the midpoint
and the maximum: the fill lands on the handle's centre to within half a pixel in every one, with the
handle at 20px in three of them and 16px in Modern.
