---
"@modyra/core": patch
"@modyra/widgets": patch
---

A value of the right shape is still held to what its kind can carry, and a narrowed step offers nothing the field refuses

Two halves of "a control may ask for less and never for more".

**The value.** Three kinds carry a string with a form — a date is ISO `yyyy-MM-dd`, a time is
`HH:mm`, a range is two dates — and only the *shape* was checked, which for all three is `string`. So
a datepicker restored from a tampered draft held `"not a date at all"`, `"9999-99-99"` or an ISO
*datetime*, and the form called itself valid and submittable. The value still reaches the model — a
form reports a shape it does not expect as a verdict rather than refusing the write — and now the
verdict exists.

**The step.** `narrowConstraints` took the higher of two steps, reading "asks for less" the way `max`
does. A step is a lattice, not a limit: 3 over a field of 2 offers `3` and `9`, which the field
refuses, so a person could stop on a value their own form rejects. The coarser lattice containing
both is the least common multiple — over 2 and 3 it is 6.
