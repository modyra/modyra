---
"@modyra/core": patch
---

The Rust reader refuses a field name or child key that holds whitespace

`sdk/rust/modyra-contract` accepted a name such as `"a b"`, which the TypeScript and Java readers
refuse: a widget id is built from the name, and whitespace splits an id reference into several. A
flat field so named is now `MDY_DYNAMIC_INVALID_FIELD`, and a group child key so named is
`MDY_DYNAMIC_UNSAFE_NAME`. Whitespace is what ECMAScript's `\s` matches.

The corpus gains a calendar document for each locale class the grammar treats specially: `en_US`,
`x-private`, `i-klingon`, `zh-min-nan` and `root` are refused, and `art-lojban` is accepted. The three
readers agree on all six. The TypeScript verdicts come from `Intl.getCanonicalLocales` and were
generated on Node 24.21 with ICU 78.3; the schema audit re-derives them on every run, so an engine
that answers differently fails it instead of passing silently.

**Migration for Rust consumers.** A document whose field names or child keys hold whitespace was
accepted and is now refused. Rename the field. The `@modyra/core` header carries the note into a
release; the npm package itself does not change.
