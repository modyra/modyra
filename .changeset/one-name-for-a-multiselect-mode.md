---
"@modyra/widgets": major
---

`MdyMultiselectFieldMode` is removed. Use `MdyMultiselectMode` from `@modyra/core`.

The two were the same union — `"single" | "multi"` — declared twice, in two packages, for one
concept. `@modyra/core` owns it: the mode is a field of the Dynamic Form Contract, which is what both
SDKs carry, and `MdyWidgetVariant` is already an alias of it so a variant key cannot drift from the
value a document holds. A second declaration was a third spelling waiting to disagree with the other
two.

Migration is the import:

```diff
-import type { MdyMultiselectFieldMode } from "@modyra/widgets";
+import type { MdyMultiselectMode } from "@modyra/core";
```

The values are unchanged, so nothing needs rewriting beyond the name.

Also: the type-surface audit now classifies exported union aliases. It read interfaces and type
literals only, so withdrawing a union — or one of its members — reported `patch`, including for the
unions renderers switch on. This removal is the change that exposed it.
