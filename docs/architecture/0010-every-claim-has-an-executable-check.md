# ADR 0010: Every claim has an executable check

Status: Accepted

## Context

This repository has repeatedly shipped statements that were true when written and false later, with
nothing in between to notice. The pattern is not carelessness; it is that the statements lived
somewhere nothing executes.

Measured instances, all found rather than hypothesised:

- A gap document's status list contradicted its own headings — twice, the second time in the very
  commit whose message said it had been corrected. It named a section that had never existed.
- Nine documentation links pointed at a page nobody had written.
- Eleven of forty-eight documentation pages were unreachable from any index.
- A capability flag declared `dom: true` unconditionally, in a package that runs without a DOM.
- A style audit reported a class as covered because a *different* kind declared the same class.
- A contract-diff tool compared capabilities by iterating the current ones, so a **withdrawn**
  capability was never visited: the single change classified as major was the one its gate could not
  see.

Each was invisible to a green test suite, because no suite was looking.

## Decision

**A claim about the repository is accompanied by something that fails when the claim stops being
true.** Where that is not possible, the absence is stated rather than left implied.

- Behavioural claims are held by tests. Structural and documentary claims are held by audit scripts
  under `scripts/`, each with a `--check` mode that exits non-zero, wired into an npm script and into
  the aggregate a contributor actually runs.
- **A ratchet never re-baselines itself.** Recording a new baseline requires an explicit `--record`;
  a script that rewrites its own expectations on every run converts debt into silence.
- **A gate's candidate set is part of the gate.** The recurring failure above is one lesson in
  several forms: *a red row is a claim about the renderer; a green mutation is a claim about the
  suite; a green audit is a claim about its candidate set; a queued plan is a claim about the
  problem; a closed finding is a claim about when it was written.*
- **A check is not trusted until it has been watched to fail.** Every non-trivial check is
  mutation-tested — break the thing deliberately, confirm the check reports it, restore. A check
  nobody has seen fail is only a claim that it works, and this repository has produced several that
  did not: an audit whose regex never matched, an agreement test whose cases could not distinguish
  `<` from `<=`.
- **A contract change is gated on its changeset**, with a semver verdict, so a breaking change cannot
  land as a patch.

## Consequences

- Adding a documented rule costs more than writing it down. That is the intended price.
- The audit surface is itself code that can rot, and it needs the same discipline it imposes — hence
  mutation testing as a standing requirement rather than a nicety.
- Some true things remain unchecked. They are to be named as such in the report that makes them, not
  quietly counted as verified.
- Checks that cannot run in this environment (a real browser, an external consumer) must say so with
  the exact command and the residual risk, never be reported as passing.

## Alternatives rejected

- **Review discipline.** Every instance above passed review. Reviewers read the diff, not the
  document the diff invalidated three directories away.
- **A documentation linter from the ecosystem.** Catches dead links; catches none of the
  repository-specific claims — a status list disagreeing with its own headings, an upstream package
  naming its dependents, a published package with no licence.
- **Generating the prose from the code.** Tried where it fits, and it does: the reactivity capability
  matrix is generated. It does not fit for anything carrying judgement, which is most of what is
  worth writing.

## Verification

This ADR is verified by the existence and wiring of the checks it mandates:

- `npm run test:contracts` — the audit aggregate: package independence, widget and plain contract,
  layout, style coverage, conformance manifest, contract snapshot, harness exceptions, docs, the
  conformance CLI against each renderer, and Patch 3 readiness.
- `npm run test:docs` — dead links (including links to git-ignored files, absent from a fresh clone),
  the gap document's status list against its own headings, orphaned pages, upstream READMEs naming
  their dependents, and published packages with no licence.
- `node scripts/contract-diff.mjs --require-changeset` — a contract change without a changeset fails.
- `npx modyra-conformance <config>` — a renderer's own conformance, runnable outside this repository.

## Security and privacy

A security property with no check is a security property with an expiry date. The concrete ones here
— no executable content in a document, drafts refusing hostile value types, an option whitelist
enforced — are all held by tests rather than by prose, which is what makes them assertable in an
audit rather than merely claimed.
