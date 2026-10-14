---
"@modyra/core": patch
---

The Java reader judges a field's initial value, range, calendar, options and validators, and a schema's count, as TS does

`sdk/java/modyra-contract` now gives the TypeScript reader's verdict and codes on a field, flat or in
a tree, as the shared corpus records them, and its path and message, for:

- `initialValue` against what its kind holds (`MDY_DYNAMIC_INVALID_FIELD`; in a tree also at
  `…/field/initialValue`). `null` is accepted only on a kind that can hold nothing, and an empty
  string on a kind holding a formatted string (a date, a time, a colour) means no value;
- a number or slider's `min`, `max` and `step`: finite numbers, `min` not above `max`, a step above
  zero;
- a datepicker, timepicker or daterange's `locale` (a tag `Intl.getCanonicalLocales` accepts),
  `firstDayOfWeek` (an integer 0–6), and `minDate`/`maxDate` (ISO dates, `minDate` not after
  `maxDate`);
- repeated option values (`MDY_DYNAMIC_DUPLICATE_OPTION`): the later option is dropped from the
  parsed field, the field is kept, and the document is not `ok`. Object values are compared by their
  members, whatever order they are written in;
- `required`, `email`, `minLength`, `maxLength` or `pattern` written on the field instead of in
  `validators` (`MDY_DYNAMIC_MISPLACED_VALIDATOR`, beside the `MDY_DYNAMIC_UNKNOWN_MEMBER` it
  already gave);
- a schema declaring more than the declarations the reader counts (`MDY_DYNAMIC_COUNT_INCOMPLETE`,
  a warning at `/schema`): the accepted and rejected counts are then a floor, not a total.

**Migration for Java consumers.** A document with any of the field defects above used to come back
`ok` with the field as written. It now comes back not `ok`; a duplicate option or a misplaced
validator keeps its field, every other field defect drops it. The caller's document is not modified:
a duplicate option is removed from the parsed field only. `MDY_DYNAMIC_COUNT_INCOMPLETE` is new and
a warning: it leaves `ok` as it was and drops nothing.
