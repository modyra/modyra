---
"@modyra/widgets": patch
---

The state matrix inspects unsupported ARIA in the states a widget *is* in

`collectStateMatrix` asked `inspectUnsupportedStateAria` only in its second pass — the default state
and the states a kind does not declare. A projection that emits a forbidden attribute
unconditionally was caught there; one conditioned on a state the kind *does* declare
(`state.readonly ? "true" : null`) was absent everywhere that pass looked, and the loop that drives
the declared states never asked. Which is the shape a real defect had.

The check now runs after every drive, so between the two passes every state a kind can reach is
inspected. No adapter in this repository changes verdict; a renderer outside it may start reporting
a kind it was announcing for.
