---
"@modyra/vue": minor
---

Vue shows the refusals no field can, sends its dates and times with a native submit, and holds a read-only file field still

**`MdyFormErrors` (ADR 0062).** A refusal naming no field — a service that is down, a handler that
threw — now has somewhere to appear in a Vue form: place `h(MdyFormErrors, { form })` where the form's
summary belongs, usually first. It draws the same `status` list, with the same classes, as the other
renderers. Nothing changes for an application that does not place it.

**A native submit carries the datepicker and the timepicker.** The datepicker sends the date the
field holds from a hidden input, never the text the box shows; the timepicker's box carries the
field's path as its `name`. Both were absent from `FormData` before.

**The timepicker draws a 24-hour clock unless told otherwise**, like every other renderer. It drew
12-hour when `format` was not given. Pass `format: "12h"` to keep the previous clock.

**A read-only file field cannot be picked from**, as in the other renderers: the file input and its
browse button are disabled while the field is read-only, and the field is still submitted and
validated.
