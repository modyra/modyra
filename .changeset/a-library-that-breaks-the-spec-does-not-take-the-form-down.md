---
"@modyra/standard-schema": patch
---

A library that breaks the spec is reported, not allowed to take the form down

The Standard Schema contract on this side is a TypeScript interface — a structural copy with zero
dependencies, and nothing checking the other end at runtime. An issue is therefore untrusted input,
and `issue.path` was read as though it were not:

```js
{ message: "…", path: "name" }        // TypeError: issue.path.map is not a function
{ message: "…", path: { key: "name" } }
{ message: "…", path: 3 }
```

That throws out of form-level validation, which runs on construction *and* on every write — so it is
not a form missing one message, it is no form at all. Every other untrusted ingress in the engine
reports and skips: an invalid RegExp source, a hostile field name, a draft of the wrong shape.

A malformed path now attributes its message to the **form** and warns once, naming the vendor from
`~standard.vendor`:

```
[modyra] @modyra/standard-schema: "pretend-validator" returned an issue where issue.path is not an
array. Standard Schema v1 says a path is an array of keys or { key } objects; the message is kept
and attributed to the form rather than to a field.
```

The message is kept: a rule the engine cannot place is still a rule the user has to be told about.
Once per vendor and shape, because form-level validation runs on every keystroke and the finding does
not become truer by repetition.

Both spellings the spec allows keep reaching their field — `["profile", "city"]` and
`[{ key: "profile" }, { key: "city" }]` — and an absent, empty or `null` path stays form-level. A
single segment written without its array, `{ key: "name" }`, is **not** accepted: it is the most
likely honest mistake and accepting it would make this adapter's shape space wider than the spec's,
so the next library guesses differently.

Found by `battle-tests/adversarial/schema-adapters/standard-issue-paths.battle.test.mjs`.
