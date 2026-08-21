---
"@modyra/lit": patch
---

Both rings of a 24-hour face are reachable with a pointer in Lit

Lit decided which ring a press landed in against a hand length it measured itself, by reading
`--tp-hand-length` from the computed style. That property resolves to a `calc()`, so the read answered
`NaN` and fell through to the face's radius — a quarter longer than the hand — which put every press
inside the inner ring, including one on the outer numbers' own centre. Tapping the 3 gave 15 and
tapping the 12 gave midnight; the outer twelve hours were reachable only by typing or with the arrows.

The measurement is `dialHandLength` in `@modyra/widgets`, which Plain and Angular already used and
which reads the hand as it is drawn.
