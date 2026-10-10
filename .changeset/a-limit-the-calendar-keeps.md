---
"@modyra/vue": minor
---

`MdyDatepickerField` and `MdyDaterangeField` take `minDate` and `maxDate`

The date kinds declare limits and the controllers enforce them, but these components had no
prop to receive them, so every day could be chosen. Both now accept ISO `minDate` and `maxDate`,
pass them to the controller, and draw a day outside the limits as a disabled button. This only
adds props. No migration.
