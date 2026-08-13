---
"@modyra/core": patch
---

A patch member that is not an array no longer deletes the rows

`form.patch({ items: response.items })` is how a list arrives from a server, and a response that
omitted the list hands the form an `undefined` — a `null` arrives the same way. Every row of the
array was deleted, silently: no diagnostic, no error, nothing to notice until the next save.

The keyed collection beside it already read such a member as saying nothing about rows, and both
managers document that rule for whole-value writes. Only the patch path turned it into an empty
array.

A patch now hands the collection the value as it came: an array replaces the rows, anything else
changes nothing, and a keyed collection reports a shape it cannot use rather than reading it as "no
rows". Rows leave because their owner said so.
