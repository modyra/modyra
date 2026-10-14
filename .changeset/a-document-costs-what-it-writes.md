---
"@modyra/core": minor
---

A dynamic document whose rows expand it far beyond what it declares is refused

`parseDynamicForm` refuses a schema whose flatten would visit more than 10,000 nodes beyond those the
schema declares, as `MDY_DYNAMIC_SCHEMA_LIMIT` at `/schema`, in both modes, with no fields. Calling
`flattenDynamicForm` or `flattenDynamicSchema` directly throws the new `MdyDynamicSchemaLimitError`
(`code`, `path`, `limit`). See ADR 0231.

Migration: a document that parsed before and is now refused declares its rows where they are used
instead of relying on a nested collection's own `initialValue` for every enclosing row. A table of a
hundred rows and a couple of dozen cells is well inside the bound.

`contract:diff` reports `patch` because it reads the widget contract only; the type surface audit
classifies the new export as `minor`, which is the level declared here.
