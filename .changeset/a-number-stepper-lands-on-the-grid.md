---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/vue": patch
"@modyra/angular": patch
---

A number field's stepper buttons step the way the box's own arrow keys do

`@modyra/widgets` exports `numberStepped(from, direction, rules)` and `MdyNumberStepRules`: one press
of a number stepper by the HTML stepping algorithm. The grid starts at `min`, an off-grid value moves
to the nearest grid value in the direction pressed, a press past a bound lands on the grid inside
it, and decimals stay exact.

Every renderer's stepper buttons now use it. Before, a press added the step and clamped. So `3` with
`min: 1, step: 5` went up to `8`, where the arrow key gives `6`, and `step: 0.1` could write
`0.30000000000000004`. A value above `max` stepped down now lands on the grid rather than on `max`,
and a press that would move against its direction does nothing.

`npm run contract:diff` reports `patch`, because the widget contract (parts, relations, keyboard)
is unchanged. The new exports make this `minor`, which is what `test:type-surface` reports.

No migration.
