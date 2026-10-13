---
"@modyra/core": patch
---

The Java reader holds a field's name to the whole TypeScript name rule

`sdk/java/modyra-contract` now drops a flat field whose name passes the segment check but that the
TypeScript reader drops, with the same code, path and sentence, in the same order:

- a name carrying a character that cannot be seen (controls, zero-width and bidirectional marks,
  U+2028–U+202E, U+2066–U+2069, a byte-order mark): `MDY_DYNAMIC_INVALID_FIELD`;
- a name longer than 512 UTF-16 units: `MDY_DYNAMIC_PATH_TOO_LONG`;
- a name with a `toString` segment: `MDY_DYNAMIC_INVALID_FIELD`;
- a name containing `__`: `MDY_DYNAMIC_INVALID_FIELD`;
- a name containing whitespace as JavaScript's `\s` reads it (no-break and ideographic spaces
  included): `MDY_DYNAMIC_INVALID_FIELD`.

A tree's child name and a record's row key are held to the same rule (`MDY_DYNAMIC_UNSAFE_NAME`
at the child or the row key), and a child the rule refuses is no longer flattened into a field.

**Migration for Java consumers.** A document with such a name was already refused by the TypeScript
reader and never rendered that field there. Rename the field: drop the invisible character, shorten
the name, avoid `toString` and `__`, and replace whitespace with `_` or `-`. The `@modyra/core`
header carries the note into a release; the npm package itself does not change.
