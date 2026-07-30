---
"@modyra/studio-ui": patch
---

The canvas fits by default, so switching size shows the difference

Reported: *"cambiando il breakpoint continuo ad avere lo stesso layout spalmato ovunque."* The
arrangement was right the whole time — what was wrong is that you could not see it.

A `md` form is 64rem and an `lg` form 80rem. The canvas between the outline and the inspector is a
few hundred pixels, and at 100% it simply scrolled: every size showed the **same left-hand slice**,
measured at 51% of the form at `lg` and 63% at `md`. Four different arrangements, all cropped to the
same visible strip, so switching size looked like it changed nothing.

The zoom therefore starts on **Fit**. It never magnifies — it is capped at 1 — so a size that already
fits is untouched and this costs nothing where it was not needed. With it, all four sizes are fully
on screen and visibly different.

Two corner cases closed with it:

- **A fit only holds for the width it was measured against**, and the panels move. Dragging the
  inspector wider is exactly when a fitted canvas would quietly stop fitting, and nothing re-rendered
  on a resize. A `ResizeObserver` on the canvas re-fits it, off the render path.
- That observer is **feature-detected**. It is a refinement, not a requirement, and hard-requiring it
  stopped Studio mounting at all where the API is absent — twelve unit tests, in the everyday case of
  a jsdom run.

The new regression test asserts what the report was about: with a different arrangement authored at
each size, every one of them is both fully on screen and its own arrangement, and the form really was
laid out at four different widths rather than one width four times.
