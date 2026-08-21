---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A ruler that was one of the things it measured

Reading the hand's own height fixed one defect and created a worse one. The hand is drawn **shorter
when it points into the inner ring**, and which ring it points into is the answer that measurement
produces:

```
hand on 14 (inner)  → measures 60  → thresholds from 60 → the same position reads outer → 2
hand on 2  (outer)  → measures 100 → thresholds 70/90   → the same position reads inner → 14
```

Each state is the other's cause. Resting on the centre of a 14 and moving two pixels alternated
`02 14 02 14 02 14 02 14` — **seven changes in eight events**, on every renderer. Not a tremor: a
feedback loop, which no amount of hysteresis damps because what moves is the thresholds themselves.

`dialHandLength` is one helper in `@modyra/widgets` and divides the shortened state back out, using
`MDY_TIMEPICKER_INNER_RING` — the constant already held against the stylesheet. The same line had been
copied into three renderers twice now, and both times it was wrong in all three; the contract owns the
question so a fourth adapter cannot copy a fourth version of it.

Found while verifying: **plain printed a 24-hour picker's hour in the canonical 12-hour form**, so a
field holding 14:00 showed `2` in its header while the face and the value said 14. The one number on
screen that says what is selected, saying something else. It reads the picker's own notation now, as
the other two do.
