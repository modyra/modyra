---
"@modyra/core": minor
---

The Dynamic Form Contract has a `record` node, beside `group` and `array`.

```json
{
  "node": "record",
  "item": { "node": "group", "children": { "name": { "node": "field", "field": { "kind": "text" } } } },
  "initialValue": { "12": { "name": "Espresso" }, "tmp:1": { "name": "Cornetto" } }
}
```

A document declares a row's shape and the rows it starts with; which rows exist afterwards remains
the application's word, because a document describes a form rather than a session. It flattens to the
dotted paths every renderer already consumes (`lines.12.name`), so no renderer needed changing, and
`buildDynamicFormSchema` turns it into a typed `record()`.

Row keys are validated as path segments: one that carries a `.` or a prototype-polluting name is
reported as `MDY_DYNAMIC_UNSAFE_NAME` and rendered by nothing. `spec/dynamic-form-v2.schema.json` and
`spec/dynamic-form-v3.schema.json` describe the node, so an editor reading `$schema` underlines a
malformed one.
