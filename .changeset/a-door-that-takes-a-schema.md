---
"@modyra/core": patch
"@modyra/zod": patch
---

A door that takes a schema refuses what is not one, by name

`createForm`, `buildFlatFormSchema`, `buildDynamicFormSchema` and the Zod bridge all took a schema and
none of them checked it. Sixteen ways of getting it wrong produced JavaScript internals:

```
createForm("nope")                  TypeError: Cannot convert undefined or null to object
buildFlatFormSchema(42)             TypeError: fields is not iterable
buildDynamicFormSchema(null)        TypeError: Cannot read properties of null (reading 'children')
createZodForm(z.array(…))           TypeError: Cannot convert undefined or null to object
```

Three different mistakes answered by one sentence naming neither the argument nor the call, which a
consumer cannot tell apart from a defect in the library.

Two were worse than an internal: `createForm(42)` and `createForm(true)` **built** — a form with no
fields that reported itself valid and submittable.

Each door now refuses by name and says what a schema is. A field list checks its entries too: an entry
that is not an object, or names nothing, is reported instead of reaching a path check that reads
`.length` off `undefined`. `createZodForm` and `buildZodTree` say that a form's schema has to name its
fields, and to wrap the shape in `z.object({ … })`.
