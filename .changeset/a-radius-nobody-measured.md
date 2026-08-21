---
"@modyra/widgets": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The radius every hit test was computed against was wrong

`--tp-hand-length` is a custom property, and a custom property resolves at *use*. Reading it back
gives the token stream — `calc(256px/2 - 40px/2 - 8px)` — which no `parseFloat` reads. So that branch
never succeeded in any renderer, and what ran every time was the fallback beside it: **half the face,
128 where the hand is drawn at 100.**

Every angle-at-a-radius in the dial was computed against a circle 28% too large: which ring a press
claims, how far off a number counts as being on it, and where the dimmed stretches fall. The inner
ring's edge landed near 95 instead of 74, which is a press just inside the outer digits reading as the
inner ring — the complaint that started this, answered until now by tuning a constant that was
compensating for a measurement.

All three renderers now measure the **hand's own drawn height**, which is the length itself rather
than an expression describing it.

Two more, both Lit and both in the dimming shipped an hour ago:

- **it never drew.** The arcs are angles at a radius, and the render that *creates* the dial cannot
  measure it — the face does not exist yet, the length read as zero, and the contract correctly
  answered `[]`, which is also the right answer for a face with nothing to dim. Nothing scheduled a
  second pass, so it was permanently absent and every unit test agreed. Lit measures in `updated()`
  now and re-renders when the answer moves.
- **the layer painted over the hand.** All three renderers carried a comment saying the dimming goes
  behind; one put it there. Lit emitted it after the hand, and Angular emitted the arcs with no layer
  element at all — which also meant Angular never drew a `dialUnavailable`, a part the contract
  declares.

`open-coverage.spec.ts` is why that last one could ship. It asserted `rendered >= 40` against a total
the contract supplies, so when the contract grew the denominator moved and the floor did not: three
parts were declared, this adapter drew one, and 42 of 48 still cleared 40. It called itself a ratchet
and nothing ever raised it. Each exemption is now named with its reason, so a part that enters the
contract and appears nowhere in the adapter fails on the day it is declared — verified by declaring
one that nothing draws and watching it fail.
