---
"@modyra/widgets": minor
---

A segment reads the numerals the field reads

The timepicker declares that reading typed text is the host's job — *"a dependency because the reading
is locale-aware and the locale belongs to the host"* — and then the new segment reader tested
`/^\d+$/`, which is `[0-9]`.

So a host supplying a locale-aware `parseEntry` got its numerals read when the whole time was typed
and **refused when the same numerals were typed into a box**. One library, one question, two answers,
written a few lines apart.

The fix is not a bigger alphabet in the regexp: this package cannot know what a numeral is anywhere,
which is exactly why the reading is a dependency. `parseSegment` is that dependency for one bare
numeral — a second *reading*, not a second answer, because `parseEntry` reads a whole time with the
host's separator, ordering and AM/PM around it and a segment has none of that. A host that localises
supplies both, in one place. Without one, segments read the digits every locale shares, as before.

**And the renderers stop parsing their own boxes.** `type-segment` reports what was typed, as it was
typed, and the controller decides — so the reader is reached by construction rather than by each
renderer remembering to consult it. That is also where the padding and the refusing lived: one
renderer reformatted after every keystroke and two reformatted the character away, which is three
answers to "what is a half-typed number" that no longer have anywhere to be.
