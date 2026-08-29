---
"@modyra/angular": patch
---

An id spelled from the field it belongs to

Four ids were built in field initializers, which run before the host settles `fieldId` — so they
spelled the id the component had *before* it was given one, and read one lower than the field they
name. `hexInput`, a range's two ends and the chip tooltip are computed now, like the label id that
had the same fault.
