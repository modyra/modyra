---
"@modyra/styles": patch
---

A visual change is a diff.

Geometry was measured everywhere — heights, insets, angles, icon sizes all had assertions — and
nothing answered *did this change something it should not have*. That question went to a person every
time a stylesheet was edited.

Screenshot baselines now answer it: two renderers × three engines × four themes, a full page and six
widgets each, 168 images committed. A failure names the widget and the theme.

**The tolerance is zero pixels**, and that is measured rather than strict for its own sake. With
animations disabled and the clock pinned, repeated runs are pixel-identical — so zero costs nothing
in flake and gives the most discrimination available.

It had to be. At a 0.2% tolerance the first version of this suite **passed with every icon 2px
larger**: it looked like coverage and was not. The mutation was verified to reach the browser before
that result was believed, which is the only reason it was caught rather than shipped.
