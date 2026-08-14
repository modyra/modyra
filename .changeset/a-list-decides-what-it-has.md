---
"@modyra/core": patch
---

A control bound to a row a list does not have waits for it

An array's rows follow its **value**: a write below its path is a row of it, which is how a restored
draft or an undo brings one back. A *claim* is not a write, and the two were indistinguishable at
the level the reconciliation read, so binding a control to `items.1.sku` on an empty list:

- created two rows, one of them a hole `getValue()` could not describe — it threw
  `Flat value does not match schema shape`;
- put a row nobody declared into `submitValue()`, with a null cell.

A virtualised table binding a row before its data arrives is exactly that call.

A list now answers what a keyed collection answers: a claim waits for the row, and binds when it
arrives. A value written below the path still grows the list to receive it, so drafts and undo are
unchanged, and a row's fields now end when the collection stops admitting them rather than when a
control releases its claim.
