---
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Every renderer's dismissal reads the declaration instead of naming the key

`Escape` closed a panel whatever was held with it, in all three renderers, and kept closing with the
declaration deleted from the contract. Fourteen conditions compared the key by hand: correct
behaviour, reached for each renderer's own reasons, so the catalogue could have lost the line that
says a dismissal answers a held modifier and nothing anywhere would have moved.

That is what a rule stated twice does. The copy keeps answering after the declaration changes, and
the next renderer has no reason to agree with either.

All fourteen ask `keyMeans(kind, event, "cancel", …)` now — including the two shared calendar helpers,
which take the kind whose grid they are drawing rather than assuming one. Removing `modifier: "any"`
reddens four kinds in the framework-free renderer, all six in the web-component one, and a contract
check in every one of the three. The two that stay green in the first are the kinds whose opener is a
button, where a key does not open the panel outside a browser and the dismissal is never reached.

ADR 0168 corrected with the measurement: it said one kind was not reading the declaration. It was
almost all of them, and the wrong number came from counting the lines a test runner repeats in its
summary rather than the checks that failed.
