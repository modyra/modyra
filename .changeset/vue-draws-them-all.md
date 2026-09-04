---
"@modyra/vue": minor
"@modyra/widgets": patch
---

`@modyra/vue` draws the multiselect, and with it every kind the catalogue declares.

The mode is the shape and it is a closed set of two: `single` is a set of toggles, `multi` a bag
where a choice can be taken more than once and every row owes a stepper and a count. A mode outside
the two resolves to a variant name the catalogue does not declare, and an undeclared variant reads
downstream as *no* requirements rather than a refusal — so the shape's checks quietly stop applying.
The component takes the declared type, and a test asserts that both modes name a shape that exists.

The per-row key is asked of the row. `ArrowLeft` and `ArrowRight` are declared **on the option**, so
they are invisible from the control: a renderer that only ever asks the control never sees them, and
the quantity is then reachable by pointer alone. This is why the key exists at all — the steppers sit
on a row, and a tab stop cannot name which row it reaches.

The always-drawn actions say whether they can act with `aria-disabled` rather than `disabled`, which
keeps them in the reading order when there is nothing to undo or clear. A control that comes and goes
moves the one beside it under the hands of somebody aiming at it.

**`@modyra/widgets`: the per-parent count rule is relaxed to "at least once".** Written as *exactly*
once, it reported both renderers that draw a multiselect's steppers correctly — the stepper is a pair
on every row, one button that takes away and one that adds. The defect the rule exists for is the
other direction, a parent with nothing to operate it, and that is still caught. ADR 0202, amended.
