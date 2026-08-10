---
"@modyra/core": patch
---

`MdyGroupOptions` is exported, so `group(children, { when })` can be typed by name.

The guide's new sections are executed rather than asserted: `docs/examples/typed-forms/` now runs
the conditional field, the conditional section with its composition, a predicate reading a nested
sibling, and every trap listed under `bounds` — the tightest bound winning, a `compose()` hiding its
own, and a non-finite bound being ignored while its rule still runs.
