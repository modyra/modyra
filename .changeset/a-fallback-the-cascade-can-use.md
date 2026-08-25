---
"@modyra/styles": patch
---

The two modern units carry a literal fallback.

`max-width: 100cqw` and `min-height: 1lh` are each preceded by a literal, which is the cascade's own
fallback: a browser that does not know the unit drops the second declaration and keeps the first.
Measured with an unknown unit standing in for an unsupported one — `320px` and `21px` instead of
nothing at all.

Without it, the failures are silent and each undoes a decision: a chip with no ceiling grows past the
field it sits in, and the way-back row reserves no line, so the page steps down 21px on every removal.

**Neither may be stated through a custom property.** A `var()` parses whatever it holds, so the failure
moves from parse time to substitution — where it takes the *inherited* value rather than the
declaration above, and the fallback is gone with the linter still green. The tier-1 scale therefore
holds plain values, and a rule that wants a modern unit writes it with its literal beside it.
