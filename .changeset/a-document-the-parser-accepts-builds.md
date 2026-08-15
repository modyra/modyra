---
"@modyra/core": patch
---

A document the parser accepts is one the engine can build

A tree of nested collections deep enough passed `parseDynamicForm(…, { mode: "strict" })` with
`ok: true` and no diagnostics, passed `buildDynamicFormSchema`, and then made `createForm` raise:

```
RangeError: Maximum call stack size exceeded
```

Around five thousand levels for a record, more for an array — a threshold that belongs to the stack
rather than to the contract. The error carries no path, cannot be caught by name, and looks exactly
like a defect in the caller's own code.

[ADR 0043](../docs/architecture/0043-a-collection-nests-without-a-limit.md) removed the depth cap on
purpose and made the document walk **iterative** for exactly this reason — *"a deep document is
parsed or rejected on its own merits instead of overflowing"*. The shape check that runs when a
collection is built stayed recursive, so the promise held on the way in and broke on the way out.

It walks over an explicit stack now. A document the parser accepts builds, at any depth it accepts.
