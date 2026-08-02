---
"@modyra/core": minor
"@modyra/plain": minor
---

A date field can name its own locale.

`MdyDynamicDateField` and `MdyDynamicDaterangeField` gain `locale`, `firstDayOfWeek`, `minDate` and
`maxDate`. Until now the contract had no locale surface at all: `mountMdyForm` could not pass one,
every renderer fell back to `navigator.language`, and Plain's `renderDatepickerField` carried an
`options` parameter its own mount path could never populate — reachable only by a host calling the
renderer directly.

`navigator.language` is the *visitor's* preference, not the form's. A booking form for an Italian
office should show an Italian calendar to a visitor whose browser is in English, and only the form
knows that.

```ts
mountMdyForm(host, [{ name: "when", kind: "datepicker", label: "When", locale: "it-IT" }]);
// L M M G V S D, in an en-US browser
```

All four are optional and unset behaves exactly as before, so no existing form changes.

`parseDynamicFields` validates them, because these arrive from config files rather than from typed
code. The locale check is the one that matters: a malformed tag does not degrade — `Intl` throws a
`RangeError` — so a config carrying `"en_US"` would have taken the form down at mount rather than
rendering an approximate calendar. `firstDayOfWeek` must be an integer from 0 to 6, the dates must
be real ISO dates (`2026-02-30` is rejected), and `minDate` may not follow `maxDate`.

A field failing any of these is dropped with a development warning, the same way a `number` field
with `min` above `max` already was.
