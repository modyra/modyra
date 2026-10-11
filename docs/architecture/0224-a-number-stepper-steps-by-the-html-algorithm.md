# ADR 0224: A number stepper steps by the HTML algorithm

Status: Accepted

## Context

A number field draws two stepper buttons beside a box whose own ArrowUp and ArrowDown are the
platform's stepping. Every renderer computed a press as `value + step`, clamped to the bounds. The
platform does something else: it steps on a grid that starts at `min`, moves an off-grid value to the
nearest grid value, and computes in decimal. So one control gave two answers. With `min: 1, step: 5`
and `3` in the box, the arrow key went to `6` and the button went to `8`. With `step: 0.1` the button
wrote `0.30000000000000004`, which then failed a `multipleOf` rule and was not equal to the `0.3` a
server compares against.

Four renderers held four copies of the arithmetic, and Angular's read the box's attributes rather
than the field's rules.

## Decision

`@modyra/widgets` exports `numberStepped(from, direction, rules)`, and every renderer that draws
steppers calls it rather than doing its own arithmetic. It implements the HTML `stepUp()` /
`stepDown()` algorithm:

- the grid starts at `min`, or at `0`, with the step's spacing; a step that is absent, zero or
  negative is `1`;
- a value on the grid moves one step, and an off-grid value moves to the nearest grid value in the
  direction pressed;
- a value pushed past a bound lands on the nearest grid value inside it, never on an off-grid bound;
- a press never moves the value against its direction, and a range with no grid value in it moves
  nothing (`null`);
- the result carries only the decimals that the step and the grid's start declare.

In one case it departs from the algorithm. In an empty box whose `0` lies outside the range, a press
in either direction enters the range at the near end. The algorithm would refuse a press toward the
far side, and Chromium's own arrow keys do enter the range here.

## Consequences

The button and the arrow key agree wherever the browser follows the HTML algorithm. Chromium's arrow
keys depart from it in three places, measured across 432 combinations of value, bounds, step and
direction:

- a value above an off-grid `max`, stepped down, lands on `max` in Chromium and on the grid here;
- an out-of-range value stepped further out is moved back inside by Chromium, against the
  direction pressed;
- `min > max` makes Chromium write one of the bounds.

In those cases the steppers and the Chromium arrow keys still differ. Here the steppers are the
ones that leave a valid value.

The widgets package gains two public names (`numberStepped`, `MdyNumberStepRules`), and 1.0 has to
keep them stable.

## Alternatives rejected

- **Fixing each renderer locally.** Fixing it in four places reproduces the drift that caused the
  defect. A fifth renderer would write the arithmetic a fifth time.
- **Matching Chromium's keyboard path exactly.** It lands on off-grid values that the same field then
  reports as a step mismatch. It is also one engine's behaviour rather than a standard.
- **Snapping inside the value controller's `increment` intent.** That intent has no `min` grid base,
  and the renderers do not dispatch it. Changing it would move a second public behaviour without
  fixing the steppers.

## Verification

- `packages/widgets/test/a-number-stepped-onto-its-grid.spec.mjs` covers the algorithm: grid snap,
  decimals, bounds, direction and the empty box.
- `a-number-stepper-lands-on-the-grid.test.mjs` in Plain, Lit and Vue, and
  `packages/angular/src/lib/renderers/number/steppers.spec.ts` in Angular, press the real buttons. Putting back the old
  `from + step` arithmetic in any one renderer fails all of its cases.
- `npm run test:type-surface` fails if either export is removed or changed.

No check compares against a live browser in CI. The cross-check against Chromium was a one-off run.

## Security and privacy

None. This is pure arithmetic on a value the person is already editing. It crosses no trust boundary
and stores or sends nothing.
