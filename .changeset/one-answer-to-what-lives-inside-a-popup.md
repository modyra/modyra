---
"@modyra/widgets": patch
---

One derivation of the overlay subtree, and stepping can always leave a bad value.

`overlayOnlyParts` and `dynamicParts` answered the same question — which parts exist only alongside
an open overlay — by two different walks. One rooted on the part *named* `popup`, the other on the
part whose *element is* `popup`. They agreed on all seventeen kinds because every popup-element part
happens to sit inside the one called `popup`, which is agreement by luck rather than by construction:
a kind whose calendar or dial sat elsewhere would have split them, and nothing would have said so.
`overlayOnlyParts` now delegates. The surviving derivation is the one with the fixed-point walk and
the test that runs it over child-first and reversed anatomies.

`stepTimeField` no longer produces `NaN`. A field holding nothing readable — an empty box coerced to
a number, a parse that failed — made the arithmetic non-finite, and the caller stored the result, so
the value became unreachable by the very key meant to change it. Stepping is documented as how a user
*leaves* a bad value, so it must not be the one operation that preserves it. A non-finite current now
enters the range from the end the user is moving away from: up from nothing is the first hour, down
from nothing is the last. Entering at `min + delta` instead would have put the first press on the
second value and left the first unreachable from the keyboard.

A property test now asserts that no combination of current and delta — `NaN`, both infinities,
negatives, values past the end — can produce anything outside the declared range.
