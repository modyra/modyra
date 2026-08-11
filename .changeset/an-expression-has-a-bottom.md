---
"@modyra/core": patch
"@modyra/studio-contract": patch
"@modyra/studio-codegen": patch
---

An expression has a bottom, so a deep document is reported instead of taking the process down.

Every recursive part of the dynamic contract was bounded — schema depth 8, 500 nodes, layout depth 6,
100 initial rows, 256 characters of pattern — except the expression tree. `JSON.parse` walks deeper
than the parser did, so a 52 KB document nesting `and` two thousand levels deep arrived intact and
`parseDynamicForm` died on it with `RangeError: Maximum call stack size exceeded`, where the contract
promises a diagnostic. An expression handed over as an object graph could also carry a cycle, which
spun the same way in `validateExpression` and `expressionPaths`.

An expression now nests at most `MDY_MAX_EXPRESSION_DEPTH` (32) levels, exported from `@modyra/core`.
Past it, validation reports a problem like any other malformed shape, path collection stops, and
evaluation returns what an unreadable rule already returns — `true`, which keeps a field visible and
fires no error. A cycle meets the bottom rather than spinning. A real condition is three or four
levels deep, so nothing an author writes is affected.

`@modyra/studio-contract` holds the same bound: a deeper condition raises `ExpressionTooDeepError`,
which its compile step reports as `EXPRESSION_TOO_DEEP` rather than as a reference to a missing
field, and `@modyra/studio-codegen`'s compiler refuses it too — the parity ADR 0007 requires between
the interpreter and the generator.

See ADR 0007, amendment "inert includes finite".
