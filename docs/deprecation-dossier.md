# The deprecation harvest, measured

What a decision about removing names would need to know, gathered before the decision is asked for.
Nothing here is a recommendation: every row is a count and where it came from.

## What a zero means here, and what it does not

**These packages are published, and 2.5.0 is on npm.** A name with no consumer inside this repository
may have consumers outside it, and this measurement cannot see them. So every zero below reads *no
use measurable here*, never *no use*. The distinction decides the cost of a removal and it is not a
formality: `@modyra/angular` exists to be consumed by applications, none of which live here.

**Perimeter.** Public names as `packages/widgets/contract-baseline/type-surface.json` records them,
843 of them. Code searched: every `.ts`, `.mjs`, `.js`, `.tsx`, `.vue`, `.svelte` under `packages`,
`battle-tests`, `e2e`, `examples`, and `docs`, plus `.java` and `.rs` under `sdk`; `dist`,
`node_modules` and `target` excluded. Prose counted separately — a name mentioned in a comment or a
`.md` has no consumer, and counting it as one is how a census reports nothing to report.

**Two exclusions, and both change the answer.** A package's own source is not a consumer of itself,
and its own tests are its own suite rather than a consumer. And
`battle-tests/types/every-published-type-is-importable.ts` is excluded by construction: it names
**every** published type, so counting it makes an orphan impossible. Including it, this census
reported 0 names with no consumer. Excluding it, 174. The first number was the instrument, not the
repository.

**One caveat on the baseline.** `npm run test:type-surface` currently reports `widgets:unread is
newly exported [minor]` — the recorded surface is one name behind the build. Everything below reads
the recorded surface, so a name added since is missing from these counts.

## The whole surface, by who names it

| | names |
| --- | --- |
| consumed by another package's source | 442 |
| used outside their package, but by no package source (tests, battles, e2e, examples) | 160 |
| named only in prose, or only by their own package's suite | 67 |
| no code outside their own package names them at all | 174 |

The 174 by package: **widgets 122 · angular 34 · core 18**.

The angular 34 is where the caveat above bites hardest: an adapter's public surface is consumed by
applications, and this repository holds one demo. Reading those 34 as unused would be reading the
absence of an audience that was never here.

## The aliases

Six type aliases repoint one name at another in source. **Four of them reach the published surface;
two do not** — checked against the recorded surface rather than assumed from the `export` keyword,
which was this dossier's own first mistake.

Published, so a removal is a public change:

| alias | package | files naming it | what it repoints | files naming the target |
| --- | --- | --- | --- | --- |
| `MdyChipMode` | widgets | 2 — its declaration and the barrel | `MdyMultiselectMode` | 11 |
| `MdyLayoutBreakpoint` | widgets | 2 — its declaration and the barrel | `MdyDynamicBreakpoint` | 4 |
| `MdyLayoutSlotPlacement` | widgets | 2 — its declaration and the barrel | `MdyDynamicSlotPlacement` | 4 |
| `MdyDynamicFormConfig` | core | 2 — its declaration and the barrel | `MdyDynamicFormDocument` | 3 |

All four are named by nothing but their own declaration and the export that publishes them, and in
every case the name they repoint is used more — which is what an alias that has finished its job
looks like from inside.

**Their cost is entirely outside.** Removing them breaks no line here; the price is paid by consumers
on npm and by nobody in this repository. That is the opposite shape from most removals, and the
reason this dossier leads with the published-packages caveat rather than closing on it.

Not published, so a removal costs nothing anywhere:

| alias | package | files naming it | what it repoints |
| --- | --- | --- | --- |
| `MdyDynamicCondition` | core | 1 — its declaration alone | `MdyExpression` |
| `MdyLitCommandHandlers` | lit | 3 — declaration, barrel, and `select-adapter.ts` | `MdyWidgetCommandHandlers` |

`MdyDynamicCondition` is written with `export` and reaches no barrel, so nothing outside its own file
can name it; `MdyLitCommandHandlers` is exported from its runtime's index but that index is not on the
package's published surface. Neither can be depended on from outside, so neither belongs in a
deprecation cycle — they are deletions, not removals.

## The members that are not exports

`effectOwnership`, `graphInspection`, `serverSnapshots` and `concealed` were handed to me as orphan
candidates. **They are not public names**: they are members of interfaces — capability keys and a
part flag — so the surface census cannot weigh them, and criterion 5's "every public export" does not
reach them. Measured as members instead, by who reads the key:

| member | read by package sources | named in tests and battles |
| --- | --- | --- |
| `effectOwnership` | 1 | 2 |
| `graphInspection` | 0 | 1 |
| `serverSnapshots` | 0 | 1 |
| `concealed` | 2 | 7 |

`graphInspection` and `serverSnapshots` are read by no source at all — every runtime declares them
and nothing consults the answer. The roadmap already places them: their consumers are in scope for
3.0.0, a devtools panel and an SSR path, which is why they exist rather than an oversight.

`concealed` is not an orphan and this measurement agrees with the record that says so: two package
sources read it and seven test files name it. ADR 0099 wants it declared twice, deliberately, for
readers outside this repository — so the honest row is *declared for external readers, record 0099*.

## What this dossier does not answer

Whether a name is used **outside** this repository. Nothing here can see npm, and for the aliases
that is the only place the cost lives. A download count is not an answer either — it says a package
was fetched, not that a name was named.

Whether the 174 without an internal consumer are unused or merely unexercised here. The two need
different remedies: one is a removal, the other is a missing test or demo, and only reading each name
tells which.
