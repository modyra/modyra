---
"@modyra/zod": minor
---

A derived form starts at an empty its own schema accepts

`createZodForm(z.object({ name: z.string() }))` seeded `null`, which `z.string()` refuses — so the
form was invalid on arrival in the schema's own type vocabulary, and valid once the user typed and
cleared the field, because `""` is a string. `required` made it a contradiction rather than an
asymmetry: it meant *the piece refuses `null`*, so the field drove `aria-required` while its own
validator accepted `""`.

A leaf now starts at an empty its piece accepts — a default, then `null`, then `""` or `false` where
the piece holds one — and `required` means *the piece refuses that empty*.

**Migration.** A form of plain `z.string()` fields is now valid and submittable on arrival, which is
what the schema says. Write `.min(1)` for a field that must be answered: it refuses the empty at
arrival and after the user clears it, in the same words.
