---
"@modyra/styles": patch
---

Three strays off the size alphabet: the slider's box, the standalone button, and three spellings of a
full corner.

- **A range input stood 20px tall.** Its height was the track's 4px and it took a text field's padding
  on top, as `content-box`, so the control was whatever the sum happened to be — under the 24px a
  pointer target needs. The element is a control step now, `border-box`, and the 4px track paints on
  `::-webkit-slider-runnable-track` / `::-moz-range-track` where its thickness is its own.
- **`.mdy-button` was 40px**, four short of WCAG 2.5.5 and a fourth height in a library that names
  three. It stands on its own with no overlay to carry a target for it, so it takes the 44px step.
- **A full corner was written three ways** — `50%`, `calc(height / 2)` and `9999px`. One spelling now,
  on the radio, the two round toggles and the switch track; on a square they draw the same circle.
- **The checkbox's 2px corner** is Material's own and the only 2 in the library. The default takes a
  radius step; the Material theme points back at the reference token, where fidelity is the point.

The radius alphabet is within its scale: three values where five are allowed, from six.
