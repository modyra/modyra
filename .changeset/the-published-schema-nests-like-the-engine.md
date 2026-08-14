---
"@modyra/core": patch
---

The published document schemas nest the way the engine does

[ADR 0043](https://github.com/modyra/modyra/blob/main/docs/architecture/0043-a-collection-nests-without-a-limit.md)
removed the one-positional-level rule from the engine and the parser. The **published JSON Schemas
kept it**: `spec/dynamic-form-v2.schema.json` and `v3` accepted a record as an array's row and
refused an array, with the reason written in the description.

So a consumer validating a document against the schema Modyra publishes was told their document was
invalid while `parseDynamicForm` accepted it — the two answers a contract exists to keep identical,
disagreeing about the shape the release's headline feature is *for*.

Both schemas now admit a collection of either kind as a row, and `spec/fixtures/dynamic-form/v3/positional-nesting.json`
carries the shape that distinguishes them: an array whose **item is an array**, as against one
reached through a group, which was always legal. `scripts/audit-contract-schema.mjs` fails on that
fixture against the old schema, naming it — so the two verdicts are checked against each other rather
than assumed to agree.

The Rust and Java SDKs still enforce the removed rule and are reported separately.
