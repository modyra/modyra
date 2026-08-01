---
"@modyra/core": minor
"@modyra/plain": minor
---

A disabled field is no longer submitted or validated

`disabled` and `readonly` were the same thing in everything but name. Both blocked interaction
identically, both were kept in the submitted value, and both were validated. The standards say
otherwise, and had done all along: a disabled control is neither submitted nor validated, and a
read-only one is both.

**Interactivity is now one value, not two flags.** `MdyFieldState.interactivity` is
`"enabled" | "readonly" | "disabled"`, and `disabled`/`readonly` are derived from it, so the
meaningless `disabled && readonly` combination cannot be represented. If a form sets both, disabled
wins: it permits strictly less, and a question the form is not asking cannot also be one it is
asserting an answer for.

**Two value types, because there are two concepts.** `form.value()` and `form.getValue()` stay
total — that is the live editing model, and drafts, history and cross-field validators all read it,
so a field must not vanish from it just because it happens to be disabled. `form.submitValue()` is
new and returns `MdySubmittedValue<S>`, which is what actually leaves the browser. `submit()`'s
callback now receives that type.

`MdySubmittedValue<S>` is optional at every level the schema declares and no deeper: a leaf inside a
group can be disabled on its own, so groups recurse, while an object-valued *leaf* like a date range
is submitted whole or not at all. `MdyFormAdapter` gained a second type parameter for it, defaulting
to `Partial<T>`, so adapters that do not know their schema are unaffected.

**What changes for you.**

- A form containing a disabled field now sends less. Read the submitted value defensively; the type
  will tell you where.
- A form blocked by a disabled required-empty field now submits. That case was unfixable by the
  user, who could not type into the field either.
- `MdyFormSubmitEvent.value` and `onSubmit` callbacks are typed as the submitted shape.
- A read-only field is unaffected: still submitted, still validated, still focusable.
