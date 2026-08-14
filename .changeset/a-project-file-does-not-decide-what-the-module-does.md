---
"@modyra/studio-codegen": patch
"@modyra/studio-model": patch
---

A project file cannot put code into the module Studio generates

`compileExpressionToJs` printed a literal operand as `String(operand)` when it was not a string. An
array is its own join:

```js
// project.json → condition.operands[1] = ["globalThis.taken = 1"]
value["a"] === globalThis.taken = 1
```

An assignment, in a module a consumer compiles and ships, decided by a file that arrives from a
repository, a template or an export. `["fetch('//elsewhere')"]` gets there the same way; an object
gives `[object Object]`, which is the same defect failing loudly. `loadProject` accepted such a
project and reported **zero diagnostics**, so nothing between the file and the generated code said a
word.

An operand is now printed by its kind: a string as an escaped string literal, a finite number and a
boolean as themselves, and anything else — an array, an object, a function, `NaN`, `Infinity` —
raises. `loadProject` reports `BAD_CONDITION_OPERAND` for the same values, reported rather than
thrown, because a project that cannot be opened cannot be repaired in the editor that reports it.

Both ends deliberately: the editor holds a file someone can fix, and every codegen target reaches the
compiler directly without loading a project through the model.

**The four kinds a condition holds compile exactly as before** — that is pinned, since reaching
further would rewrite conditions that were always correct.

Recorded as [ADR 0056](https://github.com/modyra/modyra/blob/main/docs/architecture/0056-a-project-file-does-not-decide-what-the-generated-module-does.md).
