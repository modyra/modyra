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

The remaining name rules apply too. A flat name longer than 512 characters, counted as JavaScript
counts them, is `MDY_DYNAMIC_PATH_TOO_LONG`. A name with a `toString` part shadows the method every
string conversion of the form's value goes through. A name holding `__`, the separator of a
generated id, would collide with another field's parts. Both are refused as
`MDY_DYNAMIC_INVALID_FIELD` in a flat list and as `MDY_DYNAMIC_UNSAFE_NAME` as a child key.

**Migration for Rust consumers.** A document whose field names or child keys hold whitespace, an
invisible character, `__` or a `toString` part, or a flat name past 512 characters, was accepted
and is now refused. Rename the field. The `@modyra/core` header
carries the note into a release; the npm package itself does not change.
