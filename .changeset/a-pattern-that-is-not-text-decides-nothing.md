---
"@modyra/core": patch
---

A `matches` pattern that is not text decides nothing

`evaluateExpression` read a `matches` operand that was not a string as the empty pattern, which
matches every value, so a malformed condition opened whatever it governed. It now answers `false`, as
an unknown operator or a missing operand already does. The parser refuses such a condition in a
document, so this affects only expressions built in code. ADR 0218 also records why the evaluator
keeps answering `true` past its depth limit.

No migration.
