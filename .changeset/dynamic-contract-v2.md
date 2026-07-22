---
"@modyra/core": minor
---

Add Dynamic Form Contract v2 with data-only layout sections/columns,
declarative visibility/enabled rules, structured strict/lenient parser
diagnostics, a machine-readable JSON Schema, shared conformance fixtures,
and the initial `modyra-contract` Rust crate. Contract v1 and the legacy
`parseDynamicFields()` API remain supported.

Add a runnable Rust `reqwest` POST example that sends a Contract v2 form
submission and prints both raw and typed API responses, including normalized
422 validation errors and optional bearer-token authentication.

Add an Axum form API example and connect the existing Angular dynamic-form
demo to it: Rust maps checkout business configuration to Contract v2 JSON,
Angular validates and renders it, and completed values are posted back to
Rust with success or normalized server-error output.

Extend Contract v2 with recursive `group` and `array` schema nodes. The
strict parser validates structural limits and flattens accepted nodes to the
dotted/indexed paths consumed by the Angular dynamic renderer. Rust now emits
the original checkout shape (`shipping` group and `items` array) and omits
absent option fields from JSON instead of serializing them as `null`.
