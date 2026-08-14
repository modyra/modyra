---
"@modyra/studio-codegen": patch
---

A bound that is not a finite number is reported, not emitted as `null`

`mapFieldValidator` gated a numeric bound with `typeof v.value !== "number"`. `NaN` and both
infinities have a number's type, so they passed — and `literalCode` is `JSON.stringify`, which turns
each of them into `null`:

```
minLength: 3          →  minLength(3)
minLength: "3"        →  omitted, MISSING_VALIDATOR_VALUE reported
minLength: NaN        →  minLength(null), nothing reported
minLength: Infinity   →  minLength(null), nothing reported
```

Measured against the engine rather than assumed: `minLength(3)` refuses `"ab"` and `minLength(null)`
accepts it, and it declares `minLength: null` as a fact — so the native constraint goes onto the
control too. An author writes a minimum, the generated form has none, and nothing between the two
says a word.

The gate is `Number.isFinite` now, in both places a bound is read — a field's bounds and an array's
row counts. A bound that is not a finite number is no more usable than one that is a string, which
was already reported and omitted; that case is what shows the machinery was there and only the
question was too narrow.

Found by `battle-tests/adversarial/studio/`, following the same `NaN`/`Infinity` distinction that
[ADR 0056](https://github.com/modyra/modyra/blob/main/docs/architecture/0056-a-project-file-does-not-decide-what-the-generated-module-does.md)
applied to expression operands — the second place it was needed.
