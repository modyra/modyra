---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/styles": minor
---

A column row can be authored per breakpoint

Responsiveness was a single rule in the foundation: below `40rem` every row collapsed to one column,
whatever it was and whatever it held. A form could not say "two columns from tablet, four from
desktop", so a responsive layout was not something you could declare — or test.

`MDY_LAYOUT_BREAKPOINTS` names the four sizes once — `base`, `sm` (40rem), `md` (64rem), `lg` (80rem)
— and a contract-v2 columns row takes an optional `at` saying how many tracks it shows at each. The
widths live in `@modyra/widgets` rather than in each theme, because a row that becomes two columns at
`sm` has to do it at the same width everywhere or the layout cannot be tested at all.

`layoutNodeAttributes` emits one custom property per authored size and the foundation cascades them,
each falling back to the size below, so declaring only `sm` still behaves.

**Behaviour is unchanged for existing layouts, but the properties moved.** A row that authors nothing
stacks at `base` and takes its declared tracks from `sm` up — exactly what the old `max-width: 40rem`
rule did. That means `--mdy-layout-column-count` now carries the *narrow* count (1) and
`--mdy-layout-column-count-sm` the declared one; anything asserting the old value reads the new
property instead.

`at` is validated like any other untrusted input: a track count must be an integer from 1 to 12 and
an unknown size is rejected, because it reaches the renderer as a custom property.
