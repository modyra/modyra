---
"@modyra/core": minor
"@modyra/plain": minor
---

A flattened path now rebuilds every collection it crossed.

`buildFlatFormSchema` turns a collection declared inside another collection's row
(`orders.o1.lines` inside `orders`) into a real nested descriptor — the first row
describes the child's item, and each row's leaves seed it through the parent's
initial. Plain's `mountMdyForm` walks such paths the way each collection is
addressed, so `orders.o1.lines.l1.sku` mounts a real control two collections deep.
One-level documents build exactly as before.
