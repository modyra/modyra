---
"@modyra/angular": patch
---

The way back names the value it would restore, not its identifier.

The visible offer resolved the removed value's label against the values still chosen — and a value
that was just removed is, by definition, not among them. It fell back to the option key, so the strip
read `opt_9271 removed` while the live region beside it said `Ferrovia removed`: the screen reader was
told correctly and the eye was shown the identifier.

Resolved against the options now, which is where a value that is no longer held can still be found,
and which is what the other two renderers already did.
