---
"@modyra/core": minor
---

A document's pattern cannot make the form stop answering

`validators.pattern` is a string that arrives from a CMS, a saved project or a POST. The engine
checked that it parses and never what it costs:

```
(a+)+$   against thirty characters and a miss   ->  12.6 seconds
```

Each further character roughly quadruples the work, and `^(a|a)*$` and `^(a*)*$` behave the same. A
match is synchronous, so it is not one slow field — it is the thread, between two keystrokes.

A pattern whose shape backtracks exponentially is now refused the way one that will not parse
already was: **nested unbounded repetition** (`(a+)+`, `(a*)*`) and **repeated alternatives that can
match the same text** (`(a|a)*`, `(a|ab)+`). The parser reports the new diagnostic
`MDY_DYNAMIC_PATTERN_TOO_COSTLY` and **keeps the field** — one rule the engine will not run is not a
reason to take an input away from the person filling the form.

The check reads structure, not speed, because JavaScript cannot bound a match's cost from outside it.
It is deliberately conservative: bounded repetition is left alone, and alternatives it cannot read
cheaply are allowed rather than refused on suspicion. Twelve ordinary patterns — email, IBAN, phone,
URL, zip, word alternation — are pinned as unaffected.

Typed schemas are untouched: `pattern(new RegExp(...))` in your own module is your code.

Found by `battle-tests/adversarial/security/document-patterns.battle.test.mjs`. Recorded as
[ADR 0050](https://github.com/modyra/modyra/blob/main/docs/architecture/0050-a-document-cannot-make-the-form-stop-answering.md).
