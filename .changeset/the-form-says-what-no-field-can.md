---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
"@modyra/styles": patch
---

A refusal that names no field now has somewhere to be shown

A failed network call, a service that is down, a cross-field rule only a server can check: they
arrive with no path, and the engine keeps them. No renderer had anywhere to put them — `@modyra/plain`
and `@modyra/lit` never read `lastSubmitErrors` at all, and `@modyra/angular` read it only in its
devtools panel. A person pressed Send, the answer was no, and they saw their fields exactly as they
had left them.

`@modyra/widgets` now declares the form's own parts — `MDY_FORM_SHELL_STRUCTURE`,
`MDY_FORM_SHELL_CLASSES`, `MdyFormShellPart` — and `formErrorsOf` is the one rule for what belongs in
them: the errors no field will show. The region is a `status`, it sits before the fields, and it is
rendered empty so that a screen reader already watching it announces what arrives.

`@modyra/plain` renders it from `mountMdyForm` and `@modyra/angular` from `MdyFormComponent`, both of
which own the form's own DOM. `@modyra/lit` has no form element, so it ships one to place:

```html
<mdy-form-errors .form=${form}></mdy-form-errors>
```

`@modyra/styles` paints the region bordered rather than bare — a field's error is read next to the
field it is about, and this one has to say what it is about by itself.

`mountMdyForm` inserts the region as the container's first child, so anything counting a form
container's children sees one more. Recorded as
[ADR 0062](../docs/architecture/0062-the-form-says-what-no-field-can.md).
