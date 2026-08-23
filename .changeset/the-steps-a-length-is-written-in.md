---
"@modyra/styles": minor
---

The steps every length is written in terms of.

`modyra-scale.css` is tier one: eight scales — space, size, leading, radius, stroke, control, focus,
duration — and the only place in the system where a length is a number. Nothing consumes it yet; it
exists so that what does can be checked against it.

Measured before it: 206 custom properties, every one per-component, no shared step of any kind, and
167 sizing declarations written as literals — eleven distinct `gap` values, ten `font-size`, sixteen
`padding`. The scale was already latent. `0.875rem` appeared seven times and is a type step; `16px`
and `1rem` are one step written in two units.

Each scale states its basis in the header, because a list of numbers gets edited by whoever needs a
different number. Three of those bases are conformance rather than taste:

- **0.75rem is a floor**, not a smallest-so-far: below 12px, text stops being readable for a large
  population and zoom does not recover it for everyone.
- **1.5 line height is the body default**, not the top of the scale, because a reader may set it
  there and the content must survive.
- **28px is the smallest control height that can hold a conformant 24px target**, so it is the floor
  of the control scale and not a style choice — and 36px holds one with clear zone on each side, so
  the minimum target size is satisfied by construction rather than by measurement.

A theme keeps everything it had: it still says what a component is, and may replace this file
wholesale to shift every step at once. What it gives up is inventing a value between steps.
