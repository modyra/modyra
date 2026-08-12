# ADR 0035: The colour arithmetic lives with the themes

Status: Accepted

## Context

`@modyra/core` is described as the framework-agnostic form engine. Two of its largest modules were
not that: `color-utils.ts` (713 lines of HCT, palettes and contrast maths) and `theme-compiler.ts`
(352 lines turning a palette into custom properties) — the second and sixth biggest files in the
package.

Measured before deciding, because a move that creates a dependency edge is worse than the
misplacement it fixes:

- `color-utils` imports **nothing**. `theme-compiler` imports **only** `color-utils`.
- Inside the engine, nothing imports either. Not the form, not the validators, not the dynamic
  document parser.
- Outside, no package imports them — not the widget contract, not one of the three renderers, not
  one of the five reactive adapters.
- Their only consumers are the framework-free demo, one end-to-end test, and their own two suites.
- `@modyra/styles` had **no** `@modyra` dependency of any kind, and nothing depends on `@modyra/styles`.

So the pair is a leaf with a single internal edge, and its destination is a leaf too.

## Decision

**The colour arithmetic ships with the stylesheets it generates.** `color-utils` and
`theme-compiler` move to `@modyra/styles`, which gains a JavaScript entry beside its CSS ones.
`@modyra/core/color-utils` and `@modyra/core/theme-compiler` are removed.

A theme is what these compute. The sheets in that package have named them in their own comments all
along; they lived in the engine because that is where they were written, which is a different reason
from where they belong.

## Consequences

`@modyra/styles` stops being CSS-only. It gains a TypeScript build, a versioned public surface and a
test suite — wired into `npm run test` as `test:styles`, because a move that leaves the tests
unreachable has deleted them without saying so.

Thirty-one names leave `@modyra/core`'s published surface. There is no shim: a consumer imports
`@modyra/styles` instead, and the changeset carries the table.

The dependency graph stays acyclic **by construction**, not by care: the moved half depends on
nothing and nothing depends on it, so neither direction can grow an edge. Should either module ever
need something from the engine, that edge would be the signal to reconsider this record rather than
to add the import.

The engine is smaller by a thousand lines that no form ever executed.

## Alternatives rejected

**Leave them in core.** They are pure functions with no framework and core already published them,
so nothing forced the move — except that a package's contents are what a reader uses to understand
what it is, and a form engine carrying a thousand lines of colour science teaches the wrong thing.

**A new `@modyra/theme` package.** It buys the same separation and costs a package to publish,
version and keep in changesets. `@modyra/styles` is already where a theme author looks and already
names these modules in its sheets.

## Verification

- `packages/styles/test/{color-utils,theme-compiler}.test.mjs` — moved with the code and run by
  `npm run test:styles`, which is in `npm run test`.
- `node scripts/audit-public-doors.mjs` — the removed subpaths cannot be imported anywhere in the
  repository, and every remaining import resolves.
- `npm run test:type-surface` — classifies the thirty-one removals as major.
- Nothing checks that the two modules stay dependency-free. The claim that makes this move safe is
  the absence of an edge, and no gate would notice one being added; that is the gap this record
  carries.

## Security and privacy

None. The modules compute colours from colours: no input crosses a trust boundary, nothing is stored
or transmitted, and the move changes which package publishes them rather than what they do.
