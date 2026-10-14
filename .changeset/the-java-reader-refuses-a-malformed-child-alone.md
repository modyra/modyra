---
"@modyra/core": patch
---

The Java reader refuses a tree's malformed child alone, says a refusal once, and keeps two infinities apart

`sdk/java/modyra-contract` now gives the same answers as the TypeScript reader (ADR 0230):

- A group's child that is not a node is refused alone as `MDY_DYNAMIC_INVALID_NODE`. Lenient mode
  keeps its siblings, which it used to drop with the whole document.
- `rejectedCount` counts declarations: a field kept with a finding is accepted.
- A refused tree field is reported once. The second copy, named `"leaf"` at `/fields/0` or
  `/schema`, is gone. A row value its cell cannot hold and a path too long are reported at the
  cell's declaration.
- Option values `1e400` and `-1e400` are two options. They used to be one, and the second was
  dropped as `MDY_DYNAMIC_DUPLICATE_OPTION`. The corpus's known-disagreement entry for
  `v5/opt-huge-both.json` is removed, so Java now agrees with the corpus on every document.

**Migration for Java consumers.** A lenient read of a tree with a stray child returns the fields
around it; read `ok` or the diagnostics to tell a clean document from a repaired one. Code that
counted diagnostics to learn how many fields were refused should read `rejectedCount`. The
`@modyra/core` header carries the note into a release; the npm package itself does not change.
