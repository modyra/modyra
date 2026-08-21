---
"@modyra/widgets": patch
---

A pointer at the centre is not a pointer nobody measured

The ghost's length asked `pointerReach > 0`, which puts a pointer at the exact middle of the face in
the same branch as a face nobody measured — and that branch answers with the **full** hand. So coming
inward shortened the ghost all the way to a 2.5px stub and then, at the centre, jumped it back to its
full length.

The floor the user had removed, back in a different place: *"la fine sempre sotto il mio puntatore
tranne quando la lunghezza eccede la circonferenza massima"* — the centre is not the exception, the
cap is.

The guard now asks whether a measurement was **taken**, not whether it was non-zero. `handLength <= 0`
is no geometry known and still answers with the full hand, because nothing better is available;
`pointerReach === 0` is geometry known perfectly and answers `0`.

Asserted as monotonicity over the whole radius rather than at the single point, so any later fallback
that reintroduces the same thing at another radius fails too.

ADR 0121 records the shape, because this is its fourth instance in one evening's work: an empty arc
list, a `NaN` from an unresolved `calc()`, an `"outer"` from a rectangle that was never read, and now
a real zero. Every one was silent because the wrong answer was also a correct answer to a different
question, which is why unit tests agreed with all four.
