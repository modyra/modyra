---
"@modyra/react": minor
---

`useMdyDaterangeField` — the seventh hook, for the controller that had none

`@modyra/react` is documented as shipping a hook for each widget controller, and shipped six of the
seven. `daterange` is a kind in every list the contract keeps — `MDY_FIELD_KINDS`,
`MDY_VALUE_CONTRACTS`, the structure nodes of `MDY_WIDGET_CONTRACTS` — and it has a controller; no
line of the guide named it as an exception.

`useMdyDaterangeField(handle, options)` wraps `createDaterangeFieldController` the way the datepicker
hook wraps its own, with `setBounds` beside `setValue` and `setReadonly`: a host whose bounds move
tells the controller rather than rebuilding it, which would forget the month on screen and which end
the next pick closes. `MdyReactDaterangeFieldApi` and `UseMdyDaterangeFieldOptions` come with it.
