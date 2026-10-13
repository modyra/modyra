---
"@modyra/core": patch
---

The Java reader holds a tree's fields to the flat field rules

`sdk/java/modyra-contract` now reads every field in a `schema` tree the way the TypeScript reader
does, with the same codes, paths, sentences and counts:

- a field node a flat list would drop is reported where it is written (`/schema/…/field`, named by
  its key) and again for each time the walk reads it (`/fields/0`, named `"leaf"`) — every declared
  row, and a collection's row template once even when it has no rows;
- a field whose generated path is longer than 512 UTF-16 units is dropped with
  `MDY_DYNAMIC_PATH_TOO_LONG` at `/schema`;
- each of those walk findings counts as one rejected field;
- a tree field with `options: []` is kept, as a flat one is.

**Migration for Java consumers.** A tree document with such a field used to come back `ok` with the
field silently missing; it now comes back not `ok` and says which field, which is what the TypeScript
reader already answered. Fix the field the diagnostic names. The `@modyra/core` header carries the
note into a release; the npm package itself does not change.
