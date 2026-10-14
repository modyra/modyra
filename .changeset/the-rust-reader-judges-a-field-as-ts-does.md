---
"@modyra/core": patch
---

The Rust reader judges a field's initial value, range, calendar and options as TS does

`sdk/rust/modyra-contract` now gives the TypeScript reader's verdict and codes on a field, flat or in
a tree, for:

- `initialValue` against what its kind holds (`MDY_DYNAMIC_INVALID_FIELD`; in a tree also at
  `…/field/initialValue`, as TS reports it);
- a number or slider's `min`, `max` and `step`: numbers, in order, a step above zero;
- a datepicker, timepicker or daterange's `locale` (a tag `Intl.getCanonicalLocales` accepts),
  `firstDayOfWeek` (an integer 0–6), and `minDate`/`maxDate` (ISO dates, in order);
- an option field's options (`MDY_DYNAMIC_OPTIONS_REQUIRED`) and repeated option values
  (`MDY_DYNAMIC_DUPLICATE_OPTION`, the later option dropped from the parsed form);
- `required`, `email`, `minLength`, `maxLength` or `pattern` written on the field
  (`MDY_DYNAMIC_MISPLACED_VALIDATOR`), and a member a field, its validators or an option does not
  declare (`MDY_DYNAMIC_UNKNOWN_MEMBER`);
- a number past the double range, such as `1e400`, in a field's range or a validator's bound, which
  refuses the field rather than the document.

An ISO date needs a year from 0100 on, in field bounds, initial values and rule values, because the
TypeScript reader decides dates through `Date.UTC` and refuses years 0–99.

**Migration for Rust consumers.** `parse_v2` used to return `Err` for a field whose `min`, `max` or
`step` was not a number, whose option lacked a `label` or had a non-boolean `disabled`, and for any
document holding a number past the double range; it now returns `Ok` with the diagnostic. Such a
number in a member read as an integer (`version`, `minItems`, a layout column) still returns `Err`.
Documents it used to accept with any of the defects above, including a tree option field with no
options, now come back not valid. `OPTIONS_REQUIRED` and a bad `step` are
reported at the field (`/fields/N`) rather than at `/fields/N/options` and `/fields/N/step`. A
`step`, `min` or `max` on a kind with no range is no longer read, so a text field's `step: 0` is not
refused, as it is not in TypeScript. A number past the double range that the reader accepts as any
value — an option's value, for instance — is carried in the parsed form as
`{"nonFiniteNumber": "<literal>"}`.
