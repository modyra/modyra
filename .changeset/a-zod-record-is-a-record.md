---
"@modyra/zod": patch
---

`z.record()` becomes a keyed collection instead of one opaque field.

The adapter mapped `z.object()` to a group and `z.array()` to a typed field array; everything else
became a leaf, and `z.record()` fell there. The result was a single field holding the whole object:
no rows, no `upsert`/`remove`, no cells, nothing a renderer could draw — and, because a record
rejects `null`, a form invalid from its first moment with "expected record, received null" and no
way to fix it short of `set()`ing the entire object. The engine has had keyed collections since
ADR 0026, and `@modyra/standard-schema` already honoured them; only the adapter that *derives* the
tree did not.

A `z.record(key, value)` now builds a record whose row is a group when the value is a `z.object()`
and a leaf otherwise — the same choice the array branch already makes on its element. Its initial
value follows the same rule as arrays: whatever the piece parses `undefined` into, else no rows.

**Migration.** If you have a `z.record()` in a schema, `form.f.<name>` is now a record handle rather
than a field handle: read `form.getValue().<name>` for the object, and use `upsert(key, row)`,
`remove(key)`, `rename(from, to)` and `cell(key, field)` where you previously wrote `set()` with a
whole object. The value shape is unchanged.

Nothing else changes: `z.tuple()`, `z.set()` and `z.map()` stay single fields — the engine has
no node for them, and inventing one would declare a structure the schema does not. Note that zod's
own `z.record(z.enum([...]), …)` requires every enum key to be present, so such a record is invalid
while it is empty; that is the schema's rule, not the adapter's.
