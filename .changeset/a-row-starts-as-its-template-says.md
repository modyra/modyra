---
"@modyra/core": patch
---

A row declared without a value carries the template's initial values

`upsert(key)` states that a row exists without stating its contents, and a keyed collection's item
descriptor is what a row is. Declaring a row that way read the row back from the engine first — and
a row that does not exist yet reads as `null` for every cell, so the row arrived as a row of nulls
instead of the row the template describes.

The difference was visible in the submitted payload and in every control bound to a cell that should
have started at its declared initial. `upsert(key, {})`, `patch` and `setAll` were already correct,
so the same collection produced two different rows depending on which call declared them.

Re-declaring a row that already exists is unchanged: `upsert(key)` on a declared row still keeps what
the row holds.
