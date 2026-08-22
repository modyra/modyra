---
"@modyra/styles": patch
"@modyra/lit": patch
---

A slider that wears its own theme, and a control beside its button rather than inside it

**The slider's track read the raw system colour where every other accented control reads the theme's
own accent.** Material tones its primary — `oklch(from …)` — so the slider came out near-black under a
theme whose accent is indigo, and the two were never compared because both are "the primary" one
indirection apart. `--mdy-comp-slider-active-track-color` follows `--mdy-primary`, with the system
colour as the fallback for a theme that does not derive one.

**And lit's colour field put a native `<input type="color">` inside a `<button>`** — a control nested
in a control, which is invalid HTML and reachable only by accident: the outer one takes the press, and
what a pointer lands on depends on which browser is asked. The input sits beside the button now.
