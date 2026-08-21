---
"@modyra/widgets": minor
"@modyra/core": minor
"@modyra/styles": patch
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A hand you can see thinking

A dial that offers only some times has to snap, and snapping alone hides what it is doing: the hand
jumps to a number the finger is not on, and whether that was the rule or a missed press is not
something the screen says.

So there are two hands. **The real one points at the value, including while a finger is moving** — it
used to follow the pointer, which on a face offering every time is the same thing and on one that
snaps is not: the hand sat between two numbers and jumped on release, so the one thing saying what is
chosen spent the whole gesture saying something else. **A faint one follows the pointer** whenever the
two are apart, carrying both its angle and its ring, because it answers "what happens if I release
now" while the real hand answers "what is chosen".

A picker that offers every time never draws one: its numbers are 6° apart, so the finger is never off
them. `timepickerDialGhost` decides; no renderer does.

`animateHand` — on the field in a document, an input on Angular, a property on Lit — makes the hand
move rather than jump. **Off by default**, because a hand in motion is briefly not where the value is,
and on a face that snaps the two would disagree for the length of the transition. The duration is
`--mdy-sys-motion-duration-fast`, the system's own, and `prefers-reduced-motion` turns it off.

`MDY_TIMEPICKER_RING_BAND` is published: how far either side of the inner ring's radius still counts
as reaching for it, as a fraction of the gap between the two painted radii. A fraction rather than an
expression so that tightening it is one guarded number rather than an edit to the rule.
