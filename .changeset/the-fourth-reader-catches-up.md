---
"@modyra/core": patch
---

The Rust reader reaches contract v5

`sdk/rust/modyra-contract` accepted v2 through v4 and its `Validators` was two members behind the
language — no `integer`, no `messages` — which is the shape the Java mirror was in before it caught
up. Both are now level with the TypeScript declaration.

The shared v5 fixture is read by four: the schema audit holds it against
`dynamic-form-v5.schema.json`, and the TypeScript, Java and Rust parsers each read the same file. A
version list left unswept in any of them fails somebody's suite.

The demo server serves v5 and declares `integer` on its quantity, so the newest word in the language
is exercised by the example rather than only by tests.
