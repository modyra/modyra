---
"@modyra/studio-ui": minor
---

Zoom the canvas, so a wide viewport fits a narrow screen

A `lg` viewport is 80rem. With the outline and the inspector open there is nowhere near that much
room, so the size most worth checking was the one you could not see: the canvas simply scrolled.

The canvas bar gains a zoom — 50 / 75 / 100 / 125 % and **Fit**, which works the ratio out from the
room the canvas actually has. Zoom changes how big the form is *drawn* and nothing else: it still
measures `lg`, the container queries still report `lg`, and the arrangement on screen is the `lg`
arrangement. Seeing a wide layout on a small screen was the point; showing a narrower one instead
would have defeated it.

**It is a `transform`, not the `zoom` property, and that was measured rather than assumed.** `zoom`
is inherited into the top layer, so a popup's viewport coordinates were reinterpreted in the zoomed
space and it landed about a hundred pixels off its control, above it instead of below. A transform
does not reach the top layer: the popup stays anchored, and is drawn at natural size, which also
keeps it readable while the form around it is half-size. Both facts have tests.

A transform leaves the original layout box behind, so the canvas surface is sized to the scaled
result and clips it — otherwise the canvas went on scrolling to reach a width no longer drawn
anywhere.

The preview panel now also names the breakpoint its own width reads as. Its width is whatever the
panels leave it and lands on a breakpoint almost never, so the nearest one is reported — the panel
used to show an arrangement it never named.
