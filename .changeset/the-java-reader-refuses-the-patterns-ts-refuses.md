---
"@modyra/core": patch
---

The Java reader refuses the validator patterns the TypeScript reader refuses

`sdk/java/modyra-contract` now reads a field's `validators.pattern` with the TypeScript reader's
verdicts, codes and messages:

- a pattern whose shape backtracks exponentially — a repeated group whose body can be divided
  several ways, or repeated alternatives that can match the same text (ADR 0050) — is reported with
  `MDY_DYNAMIC_PATTERN_TOO_COSTLY` at `/fields`. The field stays in lenient mode; the result is not
  `ok` in either mode. It used to be read without a word;
- a pattern a flagless JavaScript `RegExp` does not compile is reported with
  `MDY_DYNAMIC_INVALID_FIELD` at `/fields`, the field kept the same way. The verdict is JavaScript's,
  not `java.util.regex`'s: `\b+`, `^+`, `(?<=a)+` and a leading `{2}` are refused although Java
  compiles them, and `a{,5}`, `[]`, `\0`, `\c` and `\u{41}` are accepted although Java does not;
- a pattern that is not a string drops its field with `MDY_DYNAMIC_INVALID_FIELD`, and one longer
  than 256 UTF-16 units drops it with `MDY_DYNAMIC_PATTERN_TOO_LONG`, both at `/fields`. A number
  used to be read as its digits, and a long pattern was kept.

The same gate now holds for the pattern of a `matches` condition: one that does not compile says
`"matches" pattern is not a valid regular expression`, a costly one says `"matches" pattern` followed
by the cost refusal, and a pattern that fails both says both, in the condition's
`MDY_DYNAMIC_INVALID_CONDITION`. Such a condition used to be accepted.

The shared-corpus documents `v2/f-validator-pattern-catastrophic.json`,
`v2/r-validator-pattern-uncompilable.json`, `v2/s-validator-pattern-quantified-boundary.json`,
`v4/d-matches-catastrophic-pattern.json` and `v4/e-matches-uncompilable-pattern.json` now get the
same verdict from the Java reader as from the TypeScript one. The Java disagreement ledger is empty.

**Migration for Java consumers.** A document whose `validators.pattern` or `matches` pattern is refused here was already
refused by the TypeScript reader and never ran that rule in a browser; what changes is that the Java
result now says so and is no longer `ok`. Rewrite the pattern with a boundary the repeated part
cannot itself match (`^(\d{1,3}\.){3}\d{1,3}$` for `^(.*\.){3}.*$`), or without the construct
JavaScript lacks. Code that compiled `validators.pattern` with `java.util.regex` to decide whether to
run it should read the diagnostics instead. The `@modyra/core` header carries the note into a
release; the npm package itself does not change.
