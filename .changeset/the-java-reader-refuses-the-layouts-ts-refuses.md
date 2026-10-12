---
"@modyra/core": patch
---

The Java reader refuses the layouts the TypeScript reader refuses

`sdk/java/modyra-contract` accepted four kinds of layout that the TypeScript reader refuses. It now
refuses them with the same code and message:

- a slot `{ "ref": … }`, or a nested section's `at`, in a document older than version 3 →
  `MDY_DYNAMIC_UNSUPPORTED_VERSION`;
- a columns row whose `at` is not an object keyed by `base`, `sm`, `md` or `lg`, with each count an
  integer from 1 to 12 → `MDY_DYNAMIC_INVALID_LAYOUT`;
- a section at the top of the layout that carries an `at` → `MDY_DYNAMIC_INVALID_LAYOUT`;
- a placement written as `"at": null`, which used to be read as no placement and is now refused like
  any other malformed placement.

The shared-corpus document `v2/h-slot-placement-in-v2.json` now gets the same verdict from the Java
reader as from the TypeScript one, so it leaves the Java disagreement ledger.

**Migration for Java consumers.** A document that relied on one of these being accepted now loses
that layout node: in lenient mode it is dropped with a diagnostic, and in strict mode the whole
document is refused. Declare `"version": 3` to keep placement. The `@modyra/core` header carries the
note into a release; the npm package itself does not change.
