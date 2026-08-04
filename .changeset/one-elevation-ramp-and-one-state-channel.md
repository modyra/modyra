---
"@modyra/styles": minor
---

One elevation ramp, and a state channel a theme can decline.

**Elevation.** Four overlays of the same rank wore four different shadows: `--mdy-shadow-depth-2`,
the same two layers written in the opposite order, an unrelated `0 8px 32px`, and a literal buried in
a `var()` fallback chain where which shadow won depended on which of two other tokens happened to be
defined. A fifth — `0 18px 48px` in pure black, unlayered, so it outranked all of them — put the
modern theme's panels visibly higher above the page than its own 36px fields ever suggested.

There is now one ramp, `--mdy-sys-elevation-shadow-1|2|3`, in the token tier and per colour scheme.
Levels are meanings: 1 is a thing lying on the page, 2 is a panel the page opened — every dropdown,
calendar, clock and palette — and 3 is a surface over the whole page.

Shadows are tinted with `--mdy-sys-color-shadow`, which the system already derived and nothing read.
A shadow on a tinted page now belongs to that page; pure black over a coloured surface greys it.

**The state veil is a token.** `--mdy-sys-state-veil` is the tint a control carries while hovered or
focused. A filled control has only its surface to speak with and tints it; a bordered one says it
with its edge and sets the veil to `transparent`. The foundation lays the veil as a background
*image*, which a theme's `background-color` cannot displace — so a theme that overrode the colour
looked like it had opted out and quietly painted both, which is what the modern theme was doing.

**Also fixed:** `--mdy-comp-date-picker-in-range-bg` mixed toward a literal `#fff`, producing a pale
lavender band across a near-black calendar in dark mode; it is `primary-container`, which is derived
per scheme. Sixteen date-picker tokens were declared twice in one file — the second block won, and
five of the first block's names were read by nothing. Migration: a host that set
`--mdy-comp-date-picker-hover-bg`, `-selected-bg`, `-selected-color`, `-disabled-opacity` or
`-outside-opacity` was already setting a token no rule consulted; the live names carry a `cell-`
prefix.

Nothing moved in the 216 zero-tolerance screenshot baselines: every change here is a hover, focus or
open state, and the baselines capture widgets at rest.
