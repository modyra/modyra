---
"@modyra/core": minor
---

The parser reports a member the contract does not declare — on a field, its validators, an option, a
rule, a validation or a layout node — as `MDY_DYNAMIC_UNKNOWN_MEMBER`, at the path where it is
written. The published JSON Schema closes every one of those objects and an editor says so while a
document is typed; a document from a CMS, a model or a server meets neither, and the parser was the
one check it did meet. It reports rather than drops, so a document written against a newer contract
still renders in lenient mode; a strict parse — what a publishing gate asks for — refuses it. The
member lists are published as `MDY_DYNAMIC_MEMBERS`, and `npm run test:contract-schema` holds them
against every published schema in both directions: `spec/dynamic-form-v2/v3/v4.schema.json` were
missing twelve members of a field, including `mode`, `searchable`, `accept` and `presets`. See
ADR 0097.
