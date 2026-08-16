# ADR 0084: A contract version names the anatomy

Status: Accepted

## Context

`MDY_WIDGET_CONTRACT_VERSION` is published from `@modyra/widgets` and read by the audits that hold a
renderer to the catalogue: `audit-lit-widget-contract.mjs` and `audit-plain-widget-contract.mjs` both
refuse a version they were not written for, and `conformance-manifest.mjs` stamps every conformance
result with it.

Asked the question its own header says is the right one — `contract:diff --since v2.1.2` rather than
against the committed snapshot, because *"once the snapshot is updated the two agree again and the
change becomes invisible"* — the release answers:

```
classification: major        4 major · 9 minor

multiselect.searchButton     element changed: button → input   [major]
multiselect.searchButton     role changed: none → combobox     [major]
datepicker.actions           part removed                      [major]
daterange.actions            part removed                      [major]
```

The number stayed at 1. So a renderer written against "contract version 1" at 2.1.2 and one written
against "contract version 1" at 3.0.0 implement two different anatomies: two parts they were told to
build no longer exist, and a third changed both its element and its ARIA role.

Nothing published said the number had to move. The differ treats a version change as an *input* to
its classification — it records one as major — and never as something a major requires; it sees the
removals on its own. The number was not lying. It had never been told what it means.

## Decision

**The number names the anatomy, not the shape of the declaration.** An adapter reads it to say *"the
parts I build are the parts this number describes"*. It moves whenever a part a renderer was told to
build stops existing, changes its element, or gains a role — which is the set `contract:diff`
classifies major.

**It is 2 for this release**, and the constant's own doc now carries that meaning, so the next reader
does not have to infer it from an audit's `!== 1`.

**The audits pin the version they were written against rather than accepting a range.** A bump means
parts moved, so the audit is re-read and re-pinned; a range would let this line pass through exactly
the change it exists to catch.

## Consequences

**Anything comparing against `1` fails until it is re-read.** That is the point, and it is a break for
an adapter outside this repository that pinned the number — which is what pinning it is for.

**The conformance manifest is regenerated**, because every result is stamped with the version.

**The differ still does not require this.** It records a version change as major and cannot tell that
one *should* have happened, so a future release can move the anatomy and leave the number behind
again. What prevents it now is the meaning being written down where the constant is declared, plus
two audits that fail on a version they do not recognise — a person, not a gate.

## Alternatives rejected

**Leave it at 1 and let the diff carry the story.** The diff is a tool a maintainer runs; the constant
is what an adapter reads at runtime, and it is the only compatibility statement the package publishes
about its anatomy.

**Say the number names the shape of the contract** — that a contract has kinds, parts, structure and
roles — and never move it. Then it says nothing a consumer can act on, and the audits' `!== 1` is a
check against a constant that cannot change.

**Derive it from the package version.** Then it repeats what `package.json` already says, and a major
release that changes no anatomy would move it for nothing.

## Verification

- `node scripts/contract-diff.mjs --since <previous tag>` — the four major entries this record is
  about, which is the question that has to be asked against a tag rather than against the snapshot.
- `npm run test:widget-contract` — the two renderer audits refuse an unrecognised version.
- `packages/widgets/test/structure-contract.spec.mjs` — the version is pinned rather than read, so a
  suite that agreed with any anatomy is not what asserts this.

## Security and privacy

None. A published integer describing which anatomy a package implements.
