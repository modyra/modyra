---
"@modyra/angular": patch
---

One answer for whether a control announces itself as failing

Eight templates bound `aria-invalid` and one of them answered differently: the
colours field waited for `touched`, so a screen-reader user met a control the
form was rejecting while the control said nothing was wrong. The base names the
question now — `paintsAsInvalid`, computed through the contract's
`showsAsInvalid` — and every template asks it.

Neither spelling was the contract's. `errors()` already withholds the errors of a
field the form is not asking about, which is why seven of the eight were right by
construction rather than by decision; a name makes that the reason.
