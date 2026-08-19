---
"@modyra/core": patch
---

A positional collection takes a whole-number position written as text. A position arrives from a
`data-` attribute, a route parameter or a form control, and every one of those hands it over as a
string: refusing them alongside the values that name no position at all — `NaN` from a failed parse,
`undefined` from a lookup that missed — made `remove("1")` a call that changed nothing. What is still
refused is text that is not a number and a number that is not whole, which is the finding this
guard exists for.
