# ADR 0027: A register and its summary are both checked

Status: Accepted

## Context

`docs/contract-gaps.md` is the widget contract's defect register: thirty-three findings, each with
the evidence that produced it, the code path it was reproduced against, and the reasoning behind its
status. It is nearly thirteen thousand words, and it is written for someone holding the source.

It was also published on the documentation site, in the sidebar, one click from the guides. That put
a maintainer's working document in front of the reader least equipped to use it — someone deciding
whether to adopt Modyra at all, who needs to know what does not work and who it affects, not which
audit reproduced it against which build.

Deleting it was never an option: publishing defects rather than hiding them is what makes the rest
of the documentation credible, and `docs/architecture/0010` already binds every claim to a check.
The pressure was that one document was being asked to serve two readers, and served the second badly.

## Decision

**The register stays in the repository and does not go to the site. A separate page,
`docs/known-issues.md`, publishes what a consumer needs, and the two are checked against each
other.**

The register keeps its path. Architecture records, package changelogs and a widget test all cite
`docs/contract-gaps.md` by name; a move would either break those references or require editing
records that must not be edited.

`scripts/sync-docs-site.mjs` gains `SYNC_EXCLUDED`, a set of pages that stay out of the published
tree. A link to an excluded page still resolves — the sync step rewrites it to GitHub, as it already
does for every target outside `docs/`.

## Consequences

Two documents now state the same statuses, so they can disagree. That is the cost, and it is paid
by making the disagreement a build failure rather than a matter of discipline.

A finding's status is now edited in two places. The register's heading remains the source of truth;
both summaries — the register's own status list and the public page — are derived claims that the
audit compares against it.

The sidebar check has a second exemption to understand. It reads both `SIDEBAR_HIDDEN` and
`SYNC_EXCLUDED` out of the sync script rather than restating them, so a page cannot be excluded from
the site and reported as missing from the sidebar at the same time.

## Alternatives rejected

**Leave the register on the site.** It is honest, and honesty was never the problem. A reader
evaluating a form library does not reach finding R at the bottom of a maintainer's register, and one
who does learns that the iOS theme follows Apple's contrast pairing — after paragraphs about which
audit reproduced what.

**Move the register out of `docs/` entirely.** It would stop being reachable from the documentation
index, and the orphan check exists precisely to prevent a page nobody links to. It would also break
every citation in the records.

**Summarise inside the register, and publish only its opening.** The sync step renders whole files;
publishing a fragment would mean a second rendering path, and the register's summary is written for
someone who will scroll to the evidence.

**Keep one document and shorten it.** The evidence is the reason the register is trusted. Cutting it
to fit a site page would leave the claims without what supports them.

## Verification

`npm run test:docs` (`scripts/audit-docs.mjs`) fails when:

- a finding's heading and either summary disagree about its status;
- either summary names a finding the register does not define, or omits one it does;
- `docs/known-issues.md` is absent — the check reports the missing page rather than passing over it;
- `docs/contract-gaps.md` is absent, or contains no finding headings, so the check would otherwise
  be reading nothing;
- an excluded page is reported as missing from the sidebar, or a published page is not.

Each was mutation-tested: flipping finding R's status on the public page, dropping `J4a` from it,
deleting either document, and emptying `SYNC_EXCLUDED` all fail the audit.

Extending the check exposed a defect in the original. Finding ids match `[A-Z]\d*[a-z]?`, and the
previous pattern stopped at `[A-Z]\d*` — so `J4a` and `J4b` were accepted in a summary while their
headings were invisible, which is drift in exactly the direction that hides.

## Security and privacy

No trust boundary moves and no data changes hands. One indirect effect is worth stating: the register
records reproductions against built artefacts and shipped stylesheets, including the browser-engine
findings. Keeping it in the repository rather than on the site changes who is likely to read it, not
who can — it remains public, in a public repository, linked from the page that replaced it.

Withholding a known accessibility shortfall would be the security-relevant failure here. The public
page names the open finding, its measured contrast ratios, who it affects and how to override it.
