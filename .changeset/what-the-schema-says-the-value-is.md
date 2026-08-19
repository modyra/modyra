---
"@modyra/zod": major
"@modyra/standard-schema": major
---

A derived leaf is typed by what the form holds

A form holds what a person typed and what a server sent, and validates it against the schema. It does
not run the schema's transformations — `.trim()`, `.toLowerCase()`, `.transform()`, `z.coerce.*` —
and the published leaf type said otherwise: mapped over `z.output` / the Standard Schema output type,
`z.coerce.number()` declared `number | null` over a field holding `"42"`. The type promised the value
after a transformation nobody applied, which is wrong in the direction a consumer trusts.

Both trees now map over the **input** type, and the guide says so.

**Migration.** Where the two differ, a leaf's type changes: `z.coerce.number()` is now
`string | number | null` rather than `number | null`. Transform at the boundary you own — in the
submit action, or with `.transform()` applied to the value you send — rather than expecting the form
to have done it. Applying transformations on the way in was the alternative and it costs more than it
buys: `.trim()` on every keystroke takes the space out of `"a b"` while it is being typed.
