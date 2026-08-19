---
"@modyra/core": patch
---

`buildDynamicFormSchema` keeps the path limit the parser reports on: a field whose declared path is
past `MDY_MAX_DYNAMIC_PATH_LENGTH` is left out, and a group or collection left with nothing goes with
it. The parser dropped such a field and the builder built it, so a consumer rendering the reported
fields and holding data in the built form submitted a value with no control on any screen. Strict
mode also stops refusing a document for a **warning**: it refuses on errors, so
`MDY_DYNAMIC_COUNT_INCOMPLETE` — a fact about how much the reader counts, not about the document —
no longer turns a document with nothing malformed in it into zero fields. See ADR 0043's amendment.
