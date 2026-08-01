---
"@modyra/core": minor
---

`required` understands every kind's own empty value, and a half-set range is invalid

`required` only recognised `null`, `undefined`, a blank string and an empty array, so every kind
whose empty value is another shape escaped it entirely. An unchecked required checkbox, an off
required toggle and a required date range with both ends unset all reported themselves **valid** and
submitted. Plain, Angular and Lit each recorded this independently in their state matrices before
the cause was identified — three adapters describing one validation defect.

`false` now counts as empty, matching HTML, where `<input type="checkbox" required>` unchecked does
not satisfy the constraint. A toggle whose "off" is a genuine answer should simply not be marked
required.

A `{ start, end }` pair with neither end set now counts as empty too.

**`completeRange` is new, and it is not the same rule.** A range is one value with two halves, so
half of one names no interval at all — it is wrong whether or not the field is required. Every
`daterange` carries it automatically, through the same mechanism that already constrains a select to
its declared options. An optional range may be left entirely empty; it may not be left half-set.

**What changes for you.** A form with a required checkbox left unchecked, or a required range left
blank, stops passing validation — it was passing before and should not have been. A form with a
half-entered range now shows an error where it previously accepted the value silently.
