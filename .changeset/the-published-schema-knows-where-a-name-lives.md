---
"@modyra/core": patch
---

`spec/dynamic-form-v2/v3/v4.schema.json` no longer require `name` on a field written in the tree
form: there the parent's key is the name, which is why the type declares
`field: Omit<MdyDynamicField, "name">`. The published schema demanded the member the type removes, so
an editor — `apps/vscode/package.json` points every `*.form.json` at it — underlined a working
document, and following the editor meant writing a name the parser does not read. The flat list still
requires it, where the field carries its own name. `npm run test:contract-schema` now reads the v4
schema and the v4 fixture corpus, and takes each version's slots from that version's own type, so
`requiresContext` is a slot the gate knows about.
