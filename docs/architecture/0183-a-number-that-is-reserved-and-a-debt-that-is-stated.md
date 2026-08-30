# ADR 0183: A number that is reserved, and a debt that is stated

Status: Accepted

## Context

`contract:diff --since v2.4.0` classifies the release after 2.4.0 as **major**: 35 major entries
against 275 minor. Parts removed, parents moved, roles changed, a public export gone. The tool is
right, and reading the diff by hand agrees with it.

Semver would answer 3.0.0. Two things argue against spending that number here.

**The number 3 is reserved for a criterion.** It is meant to mark a public surface small enough to
keep stable — a deliberate narrowing. This release is the opposite: the type surface stands at 797
exported shapes, and it reached that figure by accretion rather than by anyone deciding it should.
Shipping 3.0.0 now spends the number on the release least like what it was reserved for, and leaves
nothing to mark the narrowing when it happens.

**And most of the packages owe nothing.** `@modyra/plain`, `@modyra/lit` and `@modyra/angular` are
below 1.0, where semver already permits breaking changes in a minor. 0.11.0 → 0.12.0 with breakage
inside is conforming, not forced. The packages are not version-locked — `.changeset/config.json`
has `fixed: []` and `linked: []` — so each moves on its own line, and the question narrows to the
two that are above 1.0.

## Decision

**`@modyra/core` and `@modyra/widgets` ship breaking changes as 2.5.0**, a minor, knowingly. The
other twenty-three packages take whatever changesets computes for them.

**The debt is paid in the changelog, in the position where the number would have warned.** A
consolidated changeset carries a BREAKING section at the head: every removed export, every removed
type member, every renamed part and the two aliases that exist, every part that became required,
every role and parent that moved. It is the body of the release page.

The rule that makes this something other than a shortcut: **a version number that under-states is
only acceptable while the text over-states.** If the BREAKING section is ever dropped, thinned, or
moved below the fold, the number has to move up instead.

## Consequences

A consumer with a caret range on `@modyra/core` or `@modyra/widgets` takes 2.5.0 without being
asked, and finds the breakage at build time rather than at upgrade time. That is the whole cost and
it falls on exactly the people semver exists to protect. Nothing in tooling mitigates it; the
changelog is the only warning, and a changelog is read by choice.

Two of twenty-five packages carry this. The other twenty-three are conforming, so the release is
not broadly dishonest — but "mostly conforming" is not a property semver has, and a consumer of
`core` does not care what `plain` was permitted to do.

The reserved 3 now has to be spent on the narrowing it was reserved for. If that narrowing never
happens, this decision will have bought nothing and cost the warning.

## Alternatives rejected

**Ship 3.0.0 and follow the tool.** Correct by convention, and the option that needs no defending.
It burns the reserved number on a release whose content contradicts the criterion, and leaves the
narrowing — when it comes — with no number to announce itself.

**Ship 3.0.0 for core and widgets, minors elsewhere.** Honest per package and the version lines
already permit it. It spends the number for the same nothing, since the two packages that would
carry the 3 are the two the criterion is about.

**Split the release: the non-breaking parts as 2.5.0 now, the breaking parts as 3.0.0 later.** The
truthful option. It requires unpicking 300 changesets into two coherent sets whose intermediate
state builds and passes, and the breaking changes are load-bearing for the non-breaking ones — the
part renames are what the new parts attach to. The intermediate state does not exist to be shipped.

**Say nothing and let the number speak.** Rejected without weighing: it is the same release with
the warning removed.

## Verification

`npm run contract:diff -- --since v2.4.0` states the classification this record departs from, so
the size of the departure is measurable rather than asserted — it must keep printing `major` for
this record to be describing the situation it claims.

The consolidated changeset is the artefact under obligation. What is **not** guarded: nothing fails
if its BREAKING section is deleted, and nothing compares the section against the diff to catch an
entry the prose missed. The rule in the Decision is a rule a person keeps, not one a gate enforces,
and that is the weakest part of this record.

## Security and privacy

None. The decision concerns a version number and the text accompanying it; no code path, data
boundary or credential is affected. The one adjacent risk is not security: a consumer taking a
breaking upgrade unprompted gets a build failure, not a silent behavioural change, because the
breakage is in types and part names rather than in runtime semantics.
