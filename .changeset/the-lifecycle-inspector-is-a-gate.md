---
"@modyra/widgets": patch
"@modyra/plain": patch
---

The lifecycle inspector has now rejected something

`mutation-suite.spec.mjs` held nineteen mutations and every one struck the DOM
inspector or the state inspector. The lifecycle inspector — the one that judges a
teardown — had never been put to the test, which is where the blind spot found in
the demo batch had lived: an effect still subscribed after dispose renders into a
document it no longer owns, and nothing in the document says so.

Five mutations join it, one per rule: a root left behind, an id still resolving, a
disposed instance that still writes, one whose effect ran and failed, and two live
instances minting the same id. Each names the rule it breaks, because asserting
only that *something* was reported lets one rule cover for another — a leftover
element raises the DOM code too, and the id rule could stop looking with the suite
still green. Verified by turning each rule off in turn.

The states panel declares the eight controllers it drives. It mounts every kind
and pushes each into disabled, readonly, touched and out of play, so every kind's
controller runs and the projection it composes reaches the DOM; the panel had
been claiming four names for work it did across all of them.
