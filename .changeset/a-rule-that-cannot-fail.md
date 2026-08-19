---
"@modyra/core": patch
---

A `required` that cannot refuse anything is reported

A kind whose empty is a usable value starts at a value `required` accepts, so the rule can never
refuse anything — `slider` is the one, and `schema.ts` says so in words. The parser took it in
silence, so an author wrote `required` to make a choice compulsory, shipped, and the form was
submitted by somebody who never touched the control: not a lost value, a constraint believed in and
absent.

Reported as `MDY_DYNAMIC_CONSTRAINT_CANNOT_FAIL`, and asked of the **kind's** empty rather than the
field's declared initial — a row that starts with values in it is not a field whose rule cannot fail.
