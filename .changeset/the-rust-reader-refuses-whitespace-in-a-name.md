---
"@modyra/core": patch
---

The Rust reader refuses a field name or child key that holds whitespace

`sdk/rust/modyra-contract` accepted a name such as `"a b"`, which the TypeScript and Java readers
refuse: a widget id is built from the name, and whitespace splits an id reference into several. A
flat field so named is now `MDY_DYNAMIC_INVALID_FIELD`, and a group child key so named is
`MDY_DYNAMIC_UNSAFE_NAME`. Whitespace is what ECMAScript's `\s` matches.

**Migration for Rust consumers.** A document whose field names or child keys hold whitespace was
accepted and is now refused. Rename the field. The `@modyra/core` header carries the note into a
release; the npm package itself does not change.
