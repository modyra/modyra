---
"@modyra/widgets": patch
---

The dead stretch across the top of the clock

The dimmed arcs left a live-looking sliver at twelve o'clock. Two removed positions either side of
0° — hour 11 at 330° and hour 12 at 0° — were drawn as two separate stretches with 7.4° of undimmed
ring between them, at the most looked-at point on a clock.

Two places asked the adjacency question and asked different things. The loop asked whether two
removed positions were **neighbours on the full face**, which is the rule; the position at 0° has no
predecessor in the list, so the seam was repaired afterwards by asking whether the first and last
arcs **overlapped**. Neighbours on an hour face are 30° apart under an 11.3° half-width and can never
touch, so that test only ever fired where nothing needed joining.

A minute face hid it: 6° spacing under the same half-width overlaps anyway, so every declaration that
thins minutes looked right and was right.

The seam now asks adjacency, like the loop. Asserted generically — every pair of removed positions one
step apart on the full face, across five granularities, three field/format pairs and both rings — so
it holds when the arcs change shape again rather than pinning twelve o'clock.
