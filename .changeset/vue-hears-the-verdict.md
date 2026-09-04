---
"@modyra/vue": patch
---

Five `@modyra/vue` components rendered once and never again, so the page disagreed with the form
about whether a field was answerable.

`MdyTextField`, `MdyBooleanField`, `MdySliderField`, `MdyFileField` and `MdyOptionField` observed
their controller through a Vue `computed`. The controller's signals belong to the runtime that owns
the *handle*, and a `computed` has nothing of Vue's to track inside one: the first render is correct
and every later one is stale. They now observe through `observerFor(field)` and an effect, as the six
components written after the lesson already did.

It was invisible in the value, because the control is uncontrolled and shows what the person typed —
which the DOM already held. It was total for everything only a render writes: `aria-invalid`,
`aria-required`, `aria-disabled` and every state class stayed at whatever they were when the field
was mounted. A required field emptied by hand left the form knowing it was invalid and the page
saying it was fine.

Reported against the text field alone by the browser tier; measuring which components shared the
shape turned one repair into five.
