# ADR 0036: The UI contract lives in one package

Status: Accepted — amends ADR 0006 by making it true

## Context

ADR 0006 states that `@modyra/widgets` is *the* complete framework-agnostic UI contract, and that the
engine knows nothing of its consumers. Three modules said otherwise.

`@modyra/core` published `icons.ts`, `keyboard.ts` and `options-utils.ts` behind `@modyra/core/ui`:
the icon geometry every renderer draws, the keyboard policy a listbox and a calendar answer to, and
the filter a search box runs. All three are what a *widget* is.

Worse than misplacement: **`@modyra/widgets` imported them from there, in five files.** The package
that is supposed to be the UI contract was reaching sideways into the engine for its own material —
`select-controller.ts`, `select-keyboard.ts`, `behavior/keys.ts`,
`field/datepicker-field-types.ts`, `field/multiselect-field-controller.ts`. Angular, Lit and the
framework-free renderer each imported the same door directly, so a widget's keyboard had two
plausible homes and every consumer picked one.

One symbol had two names on top of that: `behavior/keys.ts` re-exported `listboxNextIndex` as
`listboxNavigationIndex`, so the same function answered to different names in different renderers.

Nothing in the engine imported any of the three. Only the `ui.ts` barrel re-exported them.

## Decision

**The UI contract has one package.** `icons.ts`, `keyboard.ts` and `options-utils.ts` move to
`@modyra/widgets`. `@modyra/core/ui` is removed, with no shim.

Their own dependencies travel with them in the legal direction: the keyboard policy takes calendar
maths from `@modyra/core/datetime` and the option filter takes `MdySelectOption` from
`@modyra/core` — a downstream package importing the engine, which is the edge the architecture
already has.

**One symbol, one name.** `listboxNavigationIndex` is gone; `listboxNextIndex` is what it is called.

## Consequences

`@modyra/widgets` no longer imports the engine for UI material — the sideways edge is gone, and the
five files import their own package by path.

Consumers of `@modyra/core/ui` change one specifier. Nineteen source files did, and the removal is a
breaking change to the engine's published surface with the changeset to say so.

`@modyra/core` is smaller by 246 lines that no form executed. Together with ADR 0035 it has shed
about 1300 lines of material that was never the engine's, which is the point: what a package
contains is what a reader uses to learn what it is.

The keyboard module now sits in a package that also owns the controllers calling it. That is a
concentration — widgets grows again — and the answer to "should this be its own package" stays no
while the only consumers are the widget controllers themselves.

## Alternatives rejected

**Leave them and document the exception.** ADR 0006 already documents the rule; an exception written
beside it is a rule that has stopped applying. The measurement that mattered is that the *contract
package itself* was the biggest consumer.

**Move only what widgets imported.** Icons are drawn by renderers rather than by widgets, so the
three would have split across two packages by an accident of who imported what first — and the
subpath would have survived to publish the remainder.

## Verification

- `node scripts/audit-public-doors.mjs` — `@modyra/core/ui` cannot be imported anywhere, and every
  remaining `@modyra/core` and `@modyra/widgets` import in the repository resolves.
- `node scripts/audit-package-independence.mjs` — an upstream package naming a dependent fails.
- `npm run test:type-surface` — classifies the removals.
- Nothing forbids `@modyra/widgets` importing a *new* UI module from `@modyra/core` tomorrow. The
  independence audit reads prose and imports across adapters, not the direction of a core→widgets
  edge; that is the gap this record carries.

## Security and privacy

None. Icon geometry, key-to-target mappings and a substring filter cross no trust boundary, and the
move changes which package publishes them rather than what they compute.
