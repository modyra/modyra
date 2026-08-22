# ADR 0124: The public pitch is a single claim set

Status: Accepted

## Context

Asked "what is Modyra", three public surfaces gave three different answers. The README opened with
"Define a form once. Run it in every application that needs it.", the site's homepage with "Form
behavior that does not belong to a framework.", and the GitHub repository description with "A
framework-agnostic, type-safe form engine". A positioning plan existed, but it lived outside
version control — in Italian, and never executed — so it could not hold any surface to account.

The drift was not only verbal. The README quoted a bundle size measured versions earlier (13.4 KB
gzipped) while the dated comparison page measured the same surface at 26.3 KB; the brand page on the
site showed an indigo (`#7067FF`) that is not the brand token (`#6458EF`). Each surface was
individually reasonable; together they were a product with no single answer about itself.

## Decision

**One canonical claim set, recorded here, is the only source public surfaces draw from.**

- **Headline:** "One form contract. Every framework. Any backend."
- **Subhead:** "The typed contract between your backend and every frontend form."
- **Anti-positioning:** "Not another form state hook. A form *contract*."
- **Agent-era framing:** "Forms as data, safe enough for strangers — and agents." The Dynamic Form
  Contract's strict parsing of untrusted input is the property this line rests on; if that property
  weakens, the line goes.
- **Bundle size is quoted only as measured** by `npm run test:core-bundle`, with the version and
  date of the measurement, and always beside what the size buys. The number is never rounded down
  and never hidden.
- **Retired vocabulary:** the three headlines above and every claim CONTRIBUTING.md already forbids
  ("write once run anywhere", "zero lock-in", "enterprise-ready", "production-ready" below 1.0, and
  the rest of that list).
- The surfaces in scope are the README, the site homepage and approach page, the GitHub repository
  metadata, and the `homepage` field of published packages — which points at the documentation site,
  not back at the repository.

A public surface that needs to say something not on this list amends this record in the same change,
or does not say it.

## Consequences

Copy is now under the same evidence discipline as code: a headline change is a record change, which
is friction a marketing surface does not usually accept. Old taglines survive in history — commits,
tags and dated comparison pages keep what they said; only current surfaces are held to this list.
The GitHub repository metadata lives outside the repository, so no check in this repo can see it
drift; that surface is held by review habit alone. And a claim set recorded in one place can still
age badly as a whole — the record centralises the answer, it does not keep it true.

## Alternatives rejected

**Keep the positioning in the go-to-market plan.** That is where the failure came from: the plan is
untracked, so nothing public could be checked against it, and nothing was.

**Let each surface keep its own headline.** The status quo. Three answers to the same question read
as three products, and the maintenance cost was paid anyway — in drift, not in coordination.

**No record; fix the surfaces once.** A one-time alignment without a record is a decision nobody can
violate, which the template rightly calls a description. The first new page would have restarted the
drift.

## Verification

- `npm run test:docs` — links, orphans, sidebar coverage for the pages that carry the claims.
- `npm run test:core-bundle` — produces the only bundle figure the surfaces may quote.
- A grep for the retired headlines across README, `site/` and `docs/` — any hit outside a dated
  snapshot is a violation.
- The GitHub metadata (topics, description, homepage URL) has no in-repo check; it is set once per
  this record and verified by reading the repository page. That gap is accepted, and stated.

## Security and privacy

None. This record governs what public text says, not what code does. The one adjacent property is
that the agent-era framing leans on the contract's untrusted-input boundary
([0007](0007-expressions-are-data.md), [0009](0009-client-validation-is-defence-in-depth.md)); if
that boundary changes, the claim is reviewed with it.
