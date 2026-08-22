---
"@modyra/studio-editor": patch
"@modyra/plain": patch
---

A command costs what it changes, not what the project holds

Every Studio command began `structuredClone(project)`. Measured on a thousand fields, updating one
label cost 96% of copying all thousand — the price of an edit set by the size of the document rather
than by the edit, with a memory multiplier behind it: a twenty-step history held twenty full copies.

The node-scoped commands go through `withNode` now, which copies the path from the root to the touched
node and shares every subtree off it. The touched node itself is still deep-copied, because a change
may push to an array or write a nested member and a shallow copy would reach back into the project it
is meant to leave alone — so the cost is bounded by the edited node's own subtree instead of by the
document. `updateNode`, `addValidator`, `removeValidator`, `setFieldOptions` and `setServerValidator`
take that path.

Also: plain's multiselect leaves its overflow control disabled with the field. A button that still
answers beside a field whose ARIA says disabled is disabled in appearance only.
