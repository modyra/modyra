---
"@modyra/core": minor
---

An expression can name its own value, the form it is in, and a fact the host supplies

Three operand forms join `{path}` — `{ self: true }`, `{ root: true }` and `{ context: "key" }` —
which is the whole of what the language gains under ADR 0092. A clause written once for the item of
a collection can read *its* value, because the row has no name until somebody creates it; a
row-level condition can reach back out to the form; and a host can supply role, tenant or today's
date once for the application rather than per form.

`evaluateExpression(expr, value, scope?)` takes the scope; without one none of the three is
available, and an expression naming one answers **false** — the direction that keeps a field out of
play rather than showing it. `expressionContextKeys(expr)` lists the keys a document reads, so a
host can be asked for them before a form is built, and `expressionPaths` is unchanged: none of the
three is a field path.

Also: `equals` and `notEquals` are SameValueZero in both halves of the vocabulary. The tree's
`equals` was `Object.is`, the flat rule's was `===`, and both spellings of `in` were SameValueZero —
so `NaN` (what a number field holds when it is given text it cannot read) and `-0` got three
different verdicts across four doors, and a `rules` entry deciding whether a field is in play
decided opposite ways depending on which slot an author wrote it in.
