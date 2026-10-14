---
"@modyra/core": patch
---

A tree field's findings name it by its whole key

`parseDynamicForm` names a field in a `schema` tree by the key its parent gives it. The name was
read back off the diagnostic path, and a child key may contain `/`, so a key `a/b` was reported as
field `"b"` and a key `x/` as a field "without a name" — an error on a field that has nothing wrong
with it. The finding at `/schema/…/field` now says the key as written, in both the TypeScript reader
and `sdk/java/modyra-contract`.

**Migration.** A document with a child key ending in `/` no longer gets a false
`MDY_DYNAMIC_INVALID_FIELD`, so it may now come back `ok` where it did not. A host matching on the
text of a finding for a key with `/` in it sees the whole key. Codes and paths are unchanged.
