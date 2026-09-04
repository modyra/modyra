---
"@modyra/widgets": patch
"@modyra/vue": patch
"@modyra/angular": patch
---

`@modyra/angular` joins the two-channel section, and what it found there corrected the section and a
repair made against it.

**The section was asking a hidden element for its name.** `aria-hidden` removes an element from the
tree a screen reader walks, so a name on it means nothing — and a kind may hide its declared control
deliberately. The colour field's native picker is exactly that: kept for the people who want it,
hidden from the rest, and the contract says so in the class it gives that part —
`mdy-colors__native-hidden`. Asked anyway, the section reported two renderers as nameless for doing
what the reference renderer does.

**And the third had been repaired into diverging from all of them.** `@modyra/vue` was given an
`aria-label` on that picker earlier today to satisfy this same section, which left it exposing a
control plain and angular hide. It now hides it as they do, and the name goes where a person can be
told it: the hex box, which is what a caption points at.

`@modyra/angular` gains `declaresConfig`, translating the channel into component inputs — a number in
a binding rather than an attribute, so the component holds a number rather than a string. Its `step`,
`placeholder` and `ariaLabel` are asked for the first time.
