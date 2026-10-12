---
"@modyra/core": patch
---

The Java reader judges a condition the way the TypeScript reader does

`sdk/java/modyra-contract` now checks every expression a document carries — a schema node's `when` and
`asyncWhen`, and a validation's `when` — through one routine that mirrors `validateExpression`, and
reads the document's `rules` values and `validations` with the TypeScript reader's codes, paths and
messages:

- a condition nesting deeper than 32 levels, an operator with no operands, an `operands` that is not a
  list, an unknown operator, an operand naming two of `{path}`, `{self}`, `{root}`, `{context}`, a
  path that is not a field path, a `matches` without a literal pattern or with one longer than 256
  characters: refused with `MDY_DYNAMIC_INVALID_CONDITION` at the clause, every problem in one message
  worded as the TypeScript reader words it;
- a condition reading a path nothing enclosing the clause declares — a condition is read against what
  encloses it, and inside a collection's `item` that is the row's own cells — is refused with
  `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE` at the clause;
- a context key a condition reads anywhere in the tree, a collection's row included, and the document
  does not declare is refused with one `MDY_DYNAMIC_UNDECLARED_CONTEXT` at `/requiresContext`; the
  fields are still read. It used to be one diagnostic per key at `/schema`, and a key read inside an
  array's item was not seen at all;
- a rule's `value` is judged against its operator: `in`/`notIn` against anything but a list, an
  ordering operator against anything but a number or string, and an ordering on a date field against a
  value that is not a full `yyyy-MM-dd` date are refused with `MDY_DYNAMIC_INVALID_RULE` at
  `/rules/<i>/when/value`;
- `validations` are read: a non-array, a non-object entry, a missing message, an unknown `target`, a
  malformed `when` or one reading an unknown path are refused with `MDY_DYNAMIC_INVALID_VALIDATION` or
  `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE` at `/validations/<i>`, and count as rejected. They used to be
  ignored.

The shared-corpus documents `v2/n-validation-condition-without-operands.json`,
`v2/o-rule-membership-against-a-string.json`, `v4/a-expression-too-deep.json`,
`v4/b-expression-without-operands.json`, `v4/c-operand-names-two-references.json`,
`v4/j-row-condition-reads-undeclared-context.json` and `v4/q-condition-reads-a-path-nothing-encloses.json`
now get the same verdict from the Java reader as from the TypeScript one, so they leave the Java
disagreement ledger. `v4/d-matches-catastrophic-pattern.json` and `v4/e-matches-uncompilable-pattern.json`
stay on it: whether a `matches` pattern compiles or backtracks exponentially is the gate
`validators.pattern` passes, and this reader does not judge it yet.

**Migration for Java consumers.** A document whose conditions, rules or validations the TypeScript
reader already refused is now refused here too, in strict mode, and reported in lenient mode. A v4
document whose row conditions read a context key is held to `requiresContext` for that key: declare it.
A rule using `in` or `notIn` needs a list in `value`. The `@modyra/core` header carries the note into a
release; the npm package itself does not change.
