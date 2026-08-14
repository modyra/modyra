---
"@modyra/core": patch
---

A document's predicate reads what a field could name

`MdyExpression` addresses fields by path and was the one door that did not consult the engine's path
guard:

```js
evaluateExpression({ op: "isNotEmpty", operand: { path: "constructor" } }, {});  // true
validateExpression({ op: "equals", operands: [{ path: "__proto__" }, 1] }, "doc");  // no issues
```

An empty form has no cells, and a predicate asking about one answered `true`, because the read walked
the prototype chain. Nothing is written and nothing is polluted — what moves is which branch a
document says applies: a rule that should never fire fires, a section that should be hidden shows.

`validateExpression` now applies `isSafeFieldPath` to every `{path}` operand, so a document carrying
`__proto__`, `prototype` or `constructor` is refused where it is read; `expressionPaths` omits them,
since a path the engine will not register is not a dependency; and `evaluateExpression` answers from
the value's own properties.

`""` is unchanged and still means the root value, which is how a form-level rule reads the whole
object.

Found by `battle-tests/adversarial/security/expression-paths.battle.test.mjs`. Recorded as
[ADR 0047](https://github.com/modyra/modyra/blob/main/docs/architecture/0047-an-expression-reads-what-a-field-could-name.md).
