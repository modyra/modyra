---
"@modyra/core": minor
---

A change set says which row of a positional collection changed

`getChanges()` is documented as ready for a PATCH, and for a keyed collection it composed into
something a server could act on. For a positional one it was a compacted list of the changed rows,
with nothing saying where they were:

```
edit index 0   { list: [{ t: "EDITED" }] }
edit index 1   { list: [{ t: "EDITED" }] }   the same body
edit 0 and 2   { list: [{ t: "A" }, { t: "C" }] }   reads as 0 and 1
```

A server applying it by position wrote the wrong row in two cases out of three.

An index *is* the identity of a positional row, so a partial list is not a partial PATCH — it is an
ambiguous one. A positional collection with any change is now carried **whole**, which is the shape
`MdyFormPatch` already declares for an array: whole-item, where a record's branch is deep-partial. A
keyed collection is unchanged.

The comparison is untouched — a row is still compared against its own initial, so removing a row does
not report every row after it as changed. What is added is the rows that did *not* change, which is
what makes the position of the ones that did readable.

A PATCH carrying a long positional collection now carries all of it. Recorded as
[ADR 0072](../docs/architecture/0072-a-positional-change-set-carries-its-whole-list.md).
