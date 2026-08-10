---
"@modyra/core": minor
---

A restored draft no longer brings back a row the user deleted.

A draft is written as a flat value, and a removed row is expressible there only as an absence — so a
restore replayed the values it carried and left the schema's own seeded rows standing. The user
deleted a line, came back, and found it again: worse than losing work, because it looks like the form
disagreed with them.

`MdyPathGate` gained an optional `onReplace`, and the engine tells every keyed collection the whole
shape a snapshot carried. A row the snapshot does not mention is one that was removed before it was
written, so it stays removed; rows the snapshot adds still arrive. `MdyFormEngine.restoreValue` is
the call that does both, and drafts use it.

Also in this change:

- **A collection inside a collection is refused where it is written.** A document nesting a `record`
  in an `array` passed the parser and produced a schema that threw on the first row; the parser now
  reports it, and building the form refuses it rather than waiting for a row to arrive in front of a
  user.
- **`cell()` states its value type**: `cell<number>(key, "qty")`. The default is still `unknown`,
  because the part is a runtime string — `row(key)` remains the typed way when the part is known,
  and is what a typed control should be bound to.

**Breaking only for implementers.** `MdyPathGate` gained an optional `onReplace`, and
`MdyRecordManagerDeps` a required `warn` — the seam the typed form uses to build a collection.
Constructing an `MdyRecordManager` by hand means passing one
(`warn: (message) => engine.warnDev(message)`). Every consumer-facing call is unchanged.
