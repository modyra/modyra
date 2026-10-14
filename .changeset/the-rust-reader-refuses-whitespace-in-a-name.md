---
"@modyra/core": patch
---

The Rust reader refuses a field name or child key that holds whitespace

`sdk/rust/modyra-contract` accepted a name such as `"a b"`, which the TypeScript and Java readers
refuse: a widget id is built from the name, and whitespace splits an id reference into several. A
flat field so named is now `MDY_DYNAMIC_INVALID_FIELD`, and a group child key so named is
`MDY_DYNAMIC_UNSAFE_NAME`. Whitespace is what ECMAScript's `\s` matches.

A name holding a character that cannot be seen is refused the same way. That covers a control
character, a zero-width character, a bidirectional override or isolate, and U+FEFF. Two names that
differ only by one of these read the same and would be two fields. U+0085 is one of them: it is not
`\s` whitespace, and the Rust reader used to accept a name holding it.

**Migration for Rust consumers.** A document whose field names or child keys hold whitespace or an
invisible character was accepted and is now refused. Rename the field. The `@modyra/core` header carries the note into a
release; the npm package itself does not change.
