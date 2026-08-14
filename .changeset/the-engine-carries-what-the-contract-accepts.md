---
"@modyra/core": patch
---

A document the contract accepts is a document the engine builds

Removing the document's depth cap made `validateDynamicSchema` iterative, because untrusted input
must not decide how much stack the engine uses. The walks that run *after* it were left recursive, so
a deep document passed every check the contract offers and failed when it was used:

```js
parseDynamicForm(deep)          // ok, no diagnostics
flattenDynamicForm(deep.schema) // ok
createForm(buildDynamicFormSchema(deep.schema))  // RangeError: Maximum call stack size exceeded
```

A stack overflow is not a refusal a consumer can act on: it names no path, cannot be caught by kind,
and is the same error their own bug produces.

`buildDynamicFormSchema`, `walkSchema`, `collectItemPaths`, the collection-validator registration
walk, the row-shape check and the schema normaliser now walk over explicit stacks. A document nesting
100,000 levels parses, builds and creates a form.

**What is still bounded**: instantiating a row at *every* level, since each level's manager builds
the next while its own call is on the stack. Measured, that holds past 200 levels and gives way
somewhere before 1000 — against forms that hold two or three levels in practice. The limit is the
runtime's stack rather than a rule of the contract, so no number is pinned in a test.

Found by `battle-tests/adversarial/security/nesting-depth.battle.test.mjs`.
