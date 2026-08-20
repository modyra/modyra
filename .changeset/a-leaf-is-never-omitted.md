---
"@modyra/zod": patch
---

A derived leaf is not typed as possibly `undefined`

`MdyZodSchemaTree` types a leaf from `z.input`, which is the right half of the decision — a form
holds what a person typed, not what a transformation would produce. But a piece carrying a
`.default()` has `z.input` including `undefined`, because a *parse* may omit the key, and a form leaf
is never omitted: it exists from the moment the form is built and holds `null` until someone fills it
in.

So `z.string().default("")` derived `MdyFieldHandle<string | null | undefined>` over a field that can
only ever hold `string | null`, and every control declared for the narrower type refused the handle —
`<mdy-control-text [field]="form.f.password">` did not compile against a schema with a default.

`undefined` is excluded from the leaf. Nothing about the input-not-output decision changes.
