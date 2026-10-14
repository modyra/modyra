---
"@modyra/core": patch
---

A dynamic collection that writes more than a hundred rows is refused

`parseDynamicForm` refuses a schema in which an array's `initialValue` holds more than 100 items or a
record's holds more than 100 keys, with `MDY_DYNAMIC_SCHEMA_LIMIT` at the collection's
`initialValue`, in both modes, with no fields. The published JSON Schema has stated this cap since v2
(`maxItems` / `maxProperties: 100`), and the Java and Rust readers already refused it; the Rust
reader now reports it at the collection's `initialValue` rather than at the collection. See ADR 0232.

Migration: a document that parsed before and is now refused supplies its starting rows beyond the
hundredth as form data rather than in the document. A document that already validated against the
published JSON Schema is unaffected.

`contract:diff` reports `patch` because it reads the widget contract only. The parser is stricter
here, and `patch` is still the level declared: it now refuses only documents its own published
schema already rejected, and adds no export.
