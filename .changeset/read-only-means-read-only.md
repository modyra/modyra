---
"@modyra/core": minor
"@modyra/widgets": minor
---

A read-only field is finally read-only

`form.setReadonly()` has always set the field state, and the widget controllers have always blocked
intents when read-only, and the ARIA projection has always been ready to emit both `aria-readonly`
and the native `readonly` attribute. None of it ever ran, because one hop was missing:
`MdyFieldHandle` did not expose `readonly`, so the controllers read it from a local signal seeded by
an option no renderer passes. Every other field of that projection — `value`, `disabled`,
`required`, `touched` — came from the form. `readonly` alone did not.

The consequence was a field a form had marked read-only that still accepted typing, in every
renderer, with `aria-readonly="false"` on it while it happened. Found by the state matrix, and then
by typing into one.

`MdyFieldHandle` now exposes `readonly`, and `createFieldController`,
`createBooleanFieldController`, `createDatepickerFieldController` and
`createMultiselectFieldController` read it from the handle. `setReadonly()` on the controller stays
an imperative override for a renderer with no form behind it.

**This changes behaviour.** If you call `form.setReadonly()` today it does nothing; after this it
does what it says — the control gets the native attribute, exposes `aria-readonly="true"`, and stops
accepting input. Anything that depended on it being inert will notice.

`MdyFieldHandle` gains a required member. If you implement that interface by hand rather than taking
it from a form, add `readonly`.
