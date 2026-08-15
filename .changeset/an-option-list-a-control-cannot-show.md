---
"@modyra/core": patch
---

An option list the contract cannot read is refused where the rules are compiled

A host that assembles its own fields — rather than parsing a document — could hand `select`, `radio`,
`multiselect` or `segmented` an option list of bare strings. Each option's `value` is then
`undefined`, so the compiled rule rejects every value, and the sentence a person read was:

```
Value must be one of: undefined, undefined
```

A prefilled value arrived rejected, with `aria-invalid="true"`, for a list the author believed they
had declared. Omitting the list entirely was worse: `Cannot read properties of undefined (reading
'map')`, an engine internal surfacing on a caller's mistake.

`parseDynamicForm` already refuses both with `MDY_DYNAMIC_OPTIONS_REQUIRED`; the compiler now agrees.
It throws rather than dropping the field, because a caller on this path has no document to report a
diagnostic about — the parser has a channel and uses it, and this door does not.

An empty list is still accepted: a select whose choices arrive later is legitimate, and the published
schema allows it.
