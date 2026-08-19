---
"@modyra/core": minor
---

A document can say when — Contract v4

A document could condition a field only through `rules`, which are form-level and name a leaf. A
condition on a cell inside a collection row — the arrangement where the row is a template and its key
does not exist yet — was not expressible at all, and was registered as a limit rather than a defect.

Contract v4 gives a node its own `when` (a field and a group) and a field its `asyncWhen`, written as
the expression language batch 1 completed. A clause is read against **what encloses it**: inside a
row that is the row, so one clause written once for a template answers per row, and `{ root: true }`
is how it reaches back out to the form. `requiresContext` declares the facts the document expects
from the host; `buildDynamicFormSchema(schema, { context })` supplies them and **refuses to build**
when a key the document reads is missing, because a condition that cannot be read decides `false` and
the fields it guards would never appear.

No public slot changed type: the compiler turns a document's expression into the closure
`MdyFieldOptions.when` already takes. A v3 document is a v4 document with the version raised, and
`rules` is untouched. The parser refuses a clause that is not an expression
(`MDY_DYNAMIC_INVALID_CONDITION`), a path nothing enclosing the clause declares, and a context key
the document did not declare (`MDY_DYNAMIC_UNDECLARED_CONTEXT`). Published as
`spec/dynamic-form-v4.schema.json`. ADR 0092.
