---
"@modyra/widgets": minor
---

An empty date field can be asked whether its value is in range

`dateWithinBounds(null, …)` raised `TypeError: Cannot read properties of null (reading 'slice')`.
`MDY_VALUE_CONTRACTS` declares `datepicker` and `timepicker` nullable, so `null` is not hostile
input — it is what the field holds before the user picks, and what a host reads off the field to grey
a calendar.

It answers `false` now: the question is "may I pick this", and nothing is not a date within any
bound. Everywhere else in the engine emptiness is answered rather than refused, and this was the one
place where asking about the field's commonest state ended the frame.

The parameter type widens from `string` to `string | null | undefined`, which is why this is a minor
rather than a patch: the function accepts more than it did, and every existing call still compiles.

Found by `battle-tests/adversarial/localization/date-bounds.battle.test.mjs`.
