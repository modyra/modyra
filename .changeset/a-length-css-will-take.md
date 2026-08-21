---
"@modyra/widgets": patch
---

A ghost length CSS will actually take

Fixing the centre opened the other end of the same guard. `pointerReach !== undefined` is true of
`NaN`, so a malformed measurement stopped being treated as absent and started being treated as a
number — and the result went into `--tp-ghost-reach`.

**Non-finite is worse than wrong here.** CSS drops a declaration whose value does not parse rather
than falling back, so the property keeps whatever it had and the hand freezes where it was. A frozen
hand looks exactly like a hand that is tracking something. The previous guard's answer was the wrong
length; this one's was no answer at all, delivered as if it were one.

The reach is now checked for finiteness before it leaves, and asserted as a finite fraction in
`[0, 1]` over every combination of inputs the signature admits — including `NaN` and both infinities
on both parameters. Over the domain rather than at the values that broke, because this guard has now
failed twice in opposite directions and a case-by-case check would have passed the second time.

ADR 0121 carries it as an amendment rather than a second record: it is the same guard failing the
other way, and splitting them would let a reader fix one and reintroduce the other. The record's
rejected-alternatives section is corrected with it — a `null` sentinel closes none of these, because
`NaN` is neither `null` nor `undefined`.
