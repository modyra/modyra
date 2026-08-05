---
"@modyra/styles": minor
---

The iOS theme speaks the full HIG vocabulary.

It carried three of Apple's thirteen accents, two of four fill levels, three of four label levels, two
of six backgrounds, one of two separators and two loose tracking values. A theme that cannot name a
colour cannot use it, so anything outside that set arrived as a hex written at the site that needed
it — which is how a theme stops being the system it is named after.

The vocabulary now follows the iOS and iPadOS 27 design kit's own collections:

- **Colors** — all twelve accents, light and dark, each its own value rather than a tint of the other.
- **Fills** — `system`, `secondary`, `tertiary`, `quaternary`. The two it had were the tertiary and
  system levels under names that described strength instead of level, so a rule asking for "the
  weaker one" got whichever existed. iOS 27's stepper change — idle fill from quaternary to tertiary
  — is now a value this theme can state.
- **Labels** — four levels including quaternary.
- **Backgrounds** — plain and *grouped* families, plus the **elevated** tier dark mode uses inside
  anything presented over the screen. Without it a sheet took the base surface and had nothing left
  to separate it from the page, which is why dark iOS modals in web ports look flat.
- **Separators** — translucent and opaque.
- **Text styles** — the eleven Apple ships, as size / leading / tracking. Every `letter-spacing` in
  the theme is now one of them; they were `em` values, which scale with the font and so became a
  different tracking on every element that inherited them — the one thing Apple's tables never do.

**The slider is a slider again.** It set only a shadow and inherited the rest, arriving as a thick
tinted bar inside a filled rectangle with an accent-coloured handle. It is now a 4pt track, blue to
the left of the knob, and a 28pt white knob with a shadow, with no box: the knob stays white in both
schemes because on iOS it reads as an object above the track, and tinting it removes the only cue
that says so.
