# ADR 0028: A status sentence names a version

Status: Accepted

## Context

For most of this project's life one sentence described its maturity, and it appeared, in slightly
different words, in the README, `PRODUCT.md`, `docs/project-background.md` and the bundle
comparison: *pre-1.0, under active development*.

It stopped being true on 2026-08-09, when `@modyra/core` and `@modyra/widgets` were published at
2.0.0. It had already been imprecise before that. The workspace has never had one maturity: the
engine, eight adapters, ten Studio packages and two SDKs version independently and always have. A
single sentence over all of them was wrong in both directions at once — it undersold two packages
under a compatibility policy, and it oversold nothing, but only because it was vague enough not to.

`ROADMAP.md` compounded it. Written as a plan *toward* 1.0, it stated that core and widgets "are at
**1.0.0**" while the published versions were 2.0.0, and it listed as still open a finding the
register had recorded as fixed.

The pressure is not that a number went stale. It is that a maturity claim has no natural expiry:
nothing fails when the repository moves past it, so it survives every release and every check.

## Decision

**A statement about readiness names the packages it covers and the version they are at.** Not a
milestone, not a phase, not a mood.

Concretely: `@modyra/core` and `@modyra/widgets` are at 2.0.0 and carry the compatibility policy;
every adapter, both SDKs and Studio version independently and are below 1.0. Where a page needs to
say what a consumer can rely on, it says that, and it says it about named packages.

A milestone may be *planned* in the roadmap. It may not be used to describe the present.

## Consequences

Status sentences get longer and less quotable. "Pre-1.0" fits in a badge; "core and widgets at 2.0.0
under a compatibility policy, adapters below 1.0" does not. That is the cost, and it buys a reader
who can tell which half of the workspace they are depending on.

Every major release now touches documentation, because the version is written down rather than
implied. That is intended: a release that does not update the claim is a release that has made the
claim false.

Version numbers appear in prose, so they can drift again. They drift *detectably* — a number is
checkable against `package.json`, where a phase name is not.

## Alternatives rejected

**Keep one workspace-wide status.** It is the thing that failed. No sentence can be simultaneously
true of a package under a compatibility policy and one that may break in a minor.

**Remove version claims from prose entirely and link to npm.** A reader deciding whether to adopt
needs the shape of the answer before they go looking, and "it depends on the package" is exactly the
shape. Linking away moves the question rather than answering it.

**Generate the status line from `package.json`.** Attractive, and it would remove the drift. It also
means the sentence a reader most needs to trust is the one no author has read — and the interesting
part is not the number but which packages the promise covers, which no manifest records.

## Verification

There is **no automated check that a status sentence is current**, and that is the honest state of
this decision. `npm run test:docs` verifies links, orphans, dependency direction in prose and the
gap register's summaries; none of that would catch a page claiming 1.0 after 2.0 shipped.

What exists instead:

- `npm run contract:diff` classifies the change that forces a version bump, so a major is never
  silent;
- the release runbook (`docs/guides/release-admin-trusted-publishing.md`) is where a version becomes
  public, and updating the status claims belongs to that sequence;
- a grep for the abandoned phrasings (`pre-1.0`, `has not reached 1.0`, `are at **1.0.0**`) returns
  nothing today, which is a check anyone can repeat in one command.

This leaves the decision guarded by process rather than by a gate. Naming that is the point of the
section: the next reader knows the failure mode is a release that ships without touching prose, and
that nothing will stop it.

## Security and privacy

No trust boundary moves. One security-relevant consequence: readiness claims are what a consumer
uses to decide how much to trust client-side behaviour, and a maturity claim broader than the
evidence is how a security caveat gets read as conservatism. Stating that five adapters render
nothing — and that accessibility and theming are therefore the consumer's — is part of the same
discipline, and it is now stated next to the capability rather than in a general disclaimer.
