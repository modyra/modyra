---
"@modyra/core": major
---

`when` — a field the form only asks about under a condition.

A schema is static and a form is not. A field belonging to a branch the user did not take is
declared like every other one, so a `required()` on it makes the form permanently invalid, with the
offending field nowhere on screen to explain why. The workaround was to move the rule out of the
schema and rebuild it in application code.

```ts
reason: field("", [required()], { when: (_value, form) => form.kind === "detailed" })
```

While the condition is false the field is **inactive** — which is what a disabled field already
means here, not a fourth state: not validated by the form, not submitted, and its value kept, so a
branch the user leaves and returns to still holds what they typed. The predicate receives the
field's own value and the whole form value.

A control's `[disabled]` binding and the schema's condition are separate inputs to one state, so
neither can silently cancel the other.

Data-only documents already expressed this with a rule of effect `disabled`, and still do.

**Breaking**, all in surfaces that only the library constructs:

- `MdyFieldDescriptor`/`MdyAnyFieldDescriptor` gained a required `when` member. Code that builds a
  descriptor literal instead of calling `field()` must add `when: null`.
- `MdyFormRegistry` gained `setInactive`. A hand-written registry must implement it; forwarding to
  nothing is a valid implementation for a registry with no notion of conditional fields.
