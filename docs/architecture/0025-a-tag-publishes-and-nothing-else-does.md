# ADR 0025: A tag publishes, and nothing else does

Status: Accepted — amended 2026-08-08, see **Amendment: the tag stages**

## Context

Between 0.4.0 and this record the repository released nothing. It looked like it did. A version tag
was pushed, a release workflow ran, a maintainer read a green check, and npm kept serving 0.4.0 to
every consumer while the working tree moved four minor versions and one major ahead of it.

Two mechanisms produced that silence.

The publish step ran `release:stage`. That name was chosen for npm's staged publishing — upload now,
approve with proof of presence, make public in a second step — but what `--stage` reduced to in
`scripts/publish-workspace.mjs` was `npm publish --dry-run`: a rehearsal that packs a tarball, prints
it, and contacts no registry. It exits 0. A workflow whose only publishing step is a rehearsal is
green precisely because it published nothing.

The second is that a rehearsal never authenticates, so nothing forced the credential question to be
answered. There is no `NPM_TOKEN` in repository secrets and there never was one that worked. The
release job requests `id-token: write` and stops there.

Under the rehearsal, three defects accumulated unseen: `scripts/publish-angular.mjs` asserted that
`core`, `widgets`, `zod`, `standard-schema`, `vue`, `react`, `lit` and `styles` were all published at
`@modyra/angular`'s version, an invariant that ADR-era `fixed` versioning guaranteed and that
independent versioning ended; `scripts/publish-workspace.mjs` had grown entries for eleven Studio
packages and for `@modyra/angular`, every one of them `private: true` and none of them publishable;
and `@modyra/eslint-plugin`, public since it was written, was absent from the list entirely. Each
would have failed a real release on the first attempt. None could fail a rehearsal.

## Decision

**A pushed `v*` tag is the only thing that reaches the registry.** `.github/workflows/release.yml`
runs `pnpm run release`, which stages for real (see the amendment below). `release:rehearse` is the
local dry run and is named as one; it is not what any pipeline runs.

**The registry credential is minted per run from the workflow's OIDC token.** Every publishable
`@modyra/*` package declares a trusted publisher on npm naming this repository and `release.yml`.
No token lives in repository secrets, no credential outlives the job, and every tarball carries a
provenance attestation binding it to the commit and run that produced it.

**Each package reaches the version its own manifest declares.** Versions are independent — that is
what removing `fixed` from `.changeset/config.json` decided — so the publishers verify each package
against its own `package.json` and never against a sibling's.

**Membership comes from the workspace, order from the list.** `publish-workspace.mjs` keeps a hand
ordered list, because a consumer must not reach the registry before what it imports, and asserts
before publishing anything that the list is exactly the set of non-`private` packages under
`packages/`, minus `@modyra/angular`, which is published from its `ng-packagr` output.

## Consequences

Publishing now requires per-package administration on npm that nobody can do from this repository:
a trusted publisher configured on each package, by hand, before the first release that includes it.
A package added to the workspace fails its first release with an authentication error until that is
done — and a package that has never been published cannot be configured at all, because npm has no
settings page for a name that does not exist. Its first version must be published once by an
authenticated maintainer; `@modyra/eslint-plugin` is in exactly that position.

A release publishes package by package, so a missing publisher stops the run partway and leaves the
registry holding some of the new versions and not others. The publishers skip what is already
published, so re-running after fixing the configuration is safe and is the intended repair, but
between the two runs consumers can resolve an incoherent set.

Independent versions mean a consumer can no longer read one version number as the state of the
project, and the release tag — taken from `@modyra/core` — names the core's version, not everyone's.

What is bought is that a green release means published artifacts. The failure this record exists to
end cannot recur quietly: the run either authenticates and publishes, or it fails.

## Alternatives rejected

**`NPM_TOKEN` in repository secrets.** The path that works with no npm-side setup, and it was
rejected: a long-lived write credential to twenty-odd public packages, readable by any workflow
change that can be merged, and it does not expire when a maintainer leaves. OIDC's credential lasts
one job.

**Publishing outright, with no approval step.** Fewer moving parts, and it puts the whole release in
the hands of whatever can trigger the workflow. Staging keeps a human between a green pipeline and a
version the world can install, at the cost of a release that is not finished when the job is.

**Publishing from a maintainer's machine.** Provenance attestations require the tarball to be built
by the workflow that claims it, so a local `npm publish` produces an artifact no consumer can trace
back to a commit. It stays the bootstrap path for a package npm has never seen, and nothing more.

**Keeping `fixed` versioning** so the coherence assertion could stand. Version-locking takes every
package to the highest bump in the batch, which would have released ten unfinished Studio packages
at 2.0.0 to justify a check.

## Verification

- `scripts/publish-workspace.mjs` throws before the first publish when its list and the workspace
  disagree. Mutation-tested: marking `@modyra/eslint-plugin` `private` produces
  `Listed but private or absent: @modyra/eslint-plugin` and no package is published.
- Both publishers poll the registry after publishing and fail the run when a package does not
  appear at the version its manifest declares, so a green release job is evidence of publication
  rather than of execution.
- `npm view @modyra/core version` against `packages/core/package.json` after a release, for any
  package, is the external check.
- Unguarded: that a trusted publisher exists for every package. Nothing in this repository can read
  npm's package settings; the first release including a new package is what discovers it.

## Security and privacy

The trust boundary is the registry credential. Before this record it did not exist; after it, it is
an OIDC token exchanged for a short-lived npm credential, scoped to one workflow run, in a workflow
file whose change is a reviewable diff. No secret is stored, so none can leak from repository
settings, and revocation is removing a trusted publisher rather than rotating a shared token.

Provenance attestations are the consumer-facing half: a tarball on npm can be traced to the commit
and the run that built it, so a tarball published from anywhere else is detectable as such.

The residual exposure is that whoever can merge a change to `release.yml` can publish, since the
publisher trusts the workflow filename rather than the file's content. Branch protection on `main`
and tag-triggered releases are what stand behind that; a self-hosted runner would break it, which is
why releases run on GitHub-hosted runners only.

No user data is involved at any point.

## Amendment: the tag stages, a maintainer publishes

**2026-08-08.** The record above was written from a reading of npm 11.13, where `npm stage` does not
exist, and concluded that staged publishing was a documented feature the CLI never had. That is
wrong: npm 12 has `npm stage publish`, `npm stage list`, `npm stage view`, `npm stage approve` and
`npm stage reject`, and the release job already upgrades to npm 12. The trusted publishers on these
packages permit the staged action, so a direct `npm publish` is refused with
`403 OIDC permission denied` — which is exactly how the error reads when the publisher and the
command disagree.

What the tag does is therefore **stage**: `scripts/publish-workspace.mjs` and
`scripts/publish-angular.mjs` run `npm stage publish --provenance`, and read the staging area back to
prove every package arrived. What makes a version public is a maintainer running `npm stage approve`
with proof of presence.

The rest of this record stands. The credential is still minted per run from OIDC, no token is stored,
versions are still independent, and the failure this record exists to end — a green run that
published nothing — is still impossible, because the run now fails when the staging area does not
hold what it staged.

What changes is the cost: a release is not finished when the job is green. Between staging and
approval the registry serves the previous version, and a release left unapproved is invisible to
every consumer while looking done from the repository's side.
