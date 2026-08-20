---
"@modyra/core": patch
---

A value a kind cannot hold is refused by whichever builder made the form

`buildDynamicFormSchema` attaches each kind's shape guard to every leaf it makes; `buildFlatFormSchema`
attached none. Both are published, and the flat one is where `flattenDynamicForm`'s output goes — so
the same document, flattened and rebuilt, stopped refusing values its kinds cannot hold. Measured:

    datepicker holding "not a date at all"    tree: invalid    flat: valid

A value from outside the control is where this lands — a tampered draft, a server response, a
scripted write — and the form called itself valid and submittable, depending only on which of the two
builders the consumer called.

`buildFlatFormSchema` now attaches it too. It is not one of the document's validators — those stay in
`applyFlatValidators`, a separate call by design — it is what the *kind* is, exactly as the `shape`
option beside it already was.
