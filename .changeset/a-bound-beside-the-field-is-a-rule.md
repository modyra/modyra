---
"@modyra/core": minor
---

A bound written beside a field is enforced, not only drawn

A number's limits can be written twice, and both render `min`/`max` on the control — so a browser
refuses what a person types either way. Only one of them was a rule:

```jsonc
{ "kind": "slider", "max": 50 }                    // drew the range, enforced nothing
{ "kind": "slider", "validators": { "max": 50 } }  // enforced
```

A prefilled `150` against `max: 50` left the form holding 150 while the page showed the thumb at its
maximum, `aria-invalid="false"`, no message — a person sees a slider at 50 and sends three times
that. A tampered draft carrying a value outside the bound restored into a form that called itself
valid and submittable, which is the threat model the security guide names in those words.

`min` and `max` beside a `number` or a `slider` now compile to the same validators the explicit
spelling does. An explicit `validators` entry still wins where both are written. The rule is
generated from the field's declared bound and never from the control's drawn range, because the range
is already derived from the rules — deriving the rule back from it would close a loop.

A document that declared a bound beside a field and relied on it being only a hint now has a form
that reports values outside it. `step` is unchanged: the validator vocabulary has no `step`, so it
still speaks only to the keyboard. Recorded as
[ADR 0066](../docs/architecture/0066-a-bound-beside-the-field-is-a-rule.md).
