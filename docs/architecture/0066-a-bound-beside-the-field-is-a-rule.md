# ADR 0066: A bound beside the field is a rule

Status: Accepted

## Context

A number's limits can be written twice, and the published schema declares both:

```jsonc
{ "kind": "number", "min": 0, "max": 10 }                 // beside the field
{ "kind": "number", "validators": { "min": 0, "max": 10 } } // as a rule
```

Both render `min="0" max="10"` on the control, so a browser refuses what a person *types* either
way. Only the second was a rule. Measured:

| | beside the field | as a rule |
| --- | --- | --- |
| `set(-999)` | **valid** | invalid |
| `setValue({ n: -999 })` | **valid** | invalid |
| a draft carrying `-999` | **valid, submittable** | invalid |
| `constraints()` | `min: null, max: null` | `min: 0, max: 10` |

The draft row is the one that decides it. A draft is writable by any script on the origin, and the
security guide names that threat model in those words: a tampered draft restored into a form that
declares itself submittable.

The slider is where it is visible without tampering at all. `{ kind: "slider", max: 50 }` given a
prefilled `150` left the form holding 150 and the page showing the thumb at 50 — `aria-invalid`
false, no message. A person sees the control at its maximum and sends three times that.

Someone who writes `min: 0` beside the field watches the browser refuse `-1` and reasonably concludes
the form enforces it.

## Decision

**A bound written beside the field compiles to the same rule the explicit spelling does.** `min` and
`max` on a `number` or a `slider` produce `min()` and `max()` validators, so a value that did not come
from the keyboard — a prefill, a restored draft, a scripted write — is judged by them.

**The explicit `validators` entry wins where both are written.** It is the narrower statement of
intent, and `mergeFacts` already projects whichever promises less when two rules disagree.

**The rule is generated from the field's declared bound, never from the control's drawn range.** The
range is *already* derived from the rules — [VAL-004](../../battle-tests/charter/claims-under-test.md):
a native constraint never promises less than the validators it came from — so deriving a rule from
the range would close a loop, a rule from a range from a rule, and the day the projection changes the
loop changes meaning with nothing to say so. Measured: when the two spellings disagree the drawn
range already takes the narrower, so today they cannot diverge; the decision is about where the
sentence has its source, not about the numbers.

**`step` stays an affordance.** The validator vocabulary has no `step`, so a document saying "in
twos" still says it only to the keyboard. That gap is stated rather than closed here.

## Consequences

A document that declared a bound beside a field and relied on it being *only* a control hint now has
a form that refuses values outside it. That is the intent, and it is a behaviour change: a prefill
outside the bound was silently valid and now reports.

`constraints()` no longer distinguishes the two spellings, because there is no longer a difference to
report. That surface was the only way to tell an enforced bound from a decorative one, and it stops
being useful for the reason that made it necessary.

A slider whose document declares **no** bound is unchanged and still shows a number the form may not
hold: both renderers default the drawn range to `0–100` independently, and a value of 150 renders at
100 with nothing said. That is a defaulting decision, not a rule-generation one — the document
declared no limit, so refusing the value would assert a bound nobody wrote — and it is left open
rather than closed by an unrelated repair.

## Alternatives rejected

**Document that the field-side spelling is a hint.** It is the cheaper repair and it leaves two
spellings that render identically and mean different things, which is what a reader cannot see.

**Refuse the field-side spelling and require `validators`.** It breaks every document already using
it, for a distinction the schema itself offers.

**Generate the rule from the control's range.** It works today because the range and the bound
coincide, and it works by coincidence: the range is derived from the rules, so the rule would be
derived from itself.

## Verification

- `battle-tests/adversarial/dynamic-contract/two-ways-to-say-a-bound.battle.test.mjs` — the two
  spellings against `set`, `setValue`, `patch` and a restored draft.
- `battle-tests/browser/a-slider-that-shows-a-different-number.spec.ts` — the declared-bound rows,
  with **a value inside the range** as the control: a repair that reported an error on a value the
  document allows would pass the red and fail that one.
- Measured at the edge: a value equal to the bound stays valid, because `min`/`max` are inclusive.

## Security and privacy

This closes a path the security guide names: a draft is writable by any script on the origin, and a
tampered value outside a declared bound was restored into a form that reported itself valid and
submittable. Client-side checks remain defence in depth — the server must re-validate — but a bound
the document declared is now one the form asserts rather than one it only draws.
