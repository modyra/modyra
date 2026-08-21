---
"@modyra/widgets": patch
---

The ring boundary is where the two digit boxes meet

`MDY_TIMEPICKER_RING_BAND` goes back to `0.5`, and this time it is a derivation rather than a
judgement. A digit box is `MDY_TIMEPICKER_NUMBER_SIZE` wide and the two rings are exactly that far
apart, so the boxes touch: at a hand of 100 the inner spans 40–80 and the outer 80–120. "Midway
between the end of one box and the end of the other" has a single answer — the point where they meet
— and half the gap between the radii is its closed form.

It sat at `0.35` because it was compensating for a broken measurement: `--tp-hand-length` was read
back as an unresolved `calc()` and every renderer used half the face, 128 where the hand is 100. With
the hand measured properly, `0.35` puts the edge at 74, so radii 74–80 sit inside the inner digit's
own box while answering `outer` — point at the 21 and get the 9, which is the original complaint
mirrored 6px wide.

ADR 0120 carries the amendment. The number that was wrong is what makes the number that is right
legible, so it is on the record rather than edited away.
