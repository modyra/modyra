---
"@modyra/eslint-plugin": patch
---

The rule reads the document the parser reads, `__proto__` included.

An author-time check has no notion of validity of its own: it reconstructs the document a source
literal denotes and reports what `parseDynamicForm` says about it (ADR 0024). The reconstruction
built objects by assignment — and `out.__proto__ = value` is the one case where assignment creates no
property at all: it sets a prototype. `JSON.parse` does the opposite, and the document is JSON at
runtime, so the two sides read different documents:

- a child key named `__proto__` vanished from the rule's copy, so `MDY_DYNAMIC_UNSAFE_NAME` — raised
  by the parser at runtime — was never shown while the author was writing it;
- a node with a crafted `__proto__` **inherited** `node: "field"`, so the rule saw a valid field
  where the runtime raised `MDY_DYNAMIC_INVALID_NODE`. The editor said a document was fine and the
  application refused it.

Properties are now defined rather than assigned, which is what JSON produces for every key including
that one. Nothing changes for any other key, and the global prototype was never involved: the crafted
object was only ever the reconstruction's own prototype.
