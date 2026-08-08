# Trusted Publishing Admin Runbook

One-time setup and release operations for npm Trusted Publishing with GitHub Actions, integrated with Changesets.

The decision this runbook implements — a tag is the only thing that publishes, the credential is minted per run, versions are independent — is [ADR 0025](../architecture/0025-a-tag-publishes-and-nothing-else-does.md).

## Scope

This runbook is for npm/package admins and repository admins who manage release security and publication settings.

## Preflight (must match repository state)

Verify these files before setting publishers on npmjs.com:

1. `.github/workflows/release.yml`
   - the publish step runs `pnpm run release` (not `release:stage`, which is a local dry run)
   - workflow permissions include `id-token: write`
   - no `NODE_AUTH_TOKEN` / `NPM_TOKEN` in publish env
   - npm is upgraded to ≥ 11.5 in the job; the OIDC exchange does not exist in older CLIs
2. `package.json`
   - includes `version: changeset version && pnpm install --lockfile-only`
   - includes `release` and `release:stage` scripts
3. `.changeset/config.json`
   - `baseBranch` is `main`
   - `fixed` is empty: each package moves by its own changesets

If any of these checks fail, stop and align the repo first.

## Step 1: Configure npm Trusted Publisher

Repeat for each publishable package — the list `scripts/publish-workspace.mjs` asserts against, plus `@modyra/angular`:

1. Open package on npmjs.com.
2. Go to Package Settings, then Trusted Publishing (or Publishing Provider).
3. Select provider: GitHub Actions.
4. Fill fields exactly:
   - Organization/User: your GitHub org or user
   - Repository: `modyra`
   - Workflow filename: `release.yml`
   - Environment name: leave empty unless your workflow uses GitHub Environments
   - Allowed action: `publish`
5. Save.

Notes:

- Field values are case-sensitive.
- Trusted publishing supports GitHub-hosted runners only.
- Each package has one trusted publisher configuration at a time.

### A package npm has never seen

npm has no settings page for a name that does not exist, so a brand-new package cannot be configured in advance. Publish its first version once as an authenticated maintainer:

```bash
npm login
npm publish --access public   # from the package directory
```

Then configure its trusted publisher as above. Every later version comes from the workflow.

## Step 2: Changesets release flow (what to expect)

This repo is Changesets-driven:

1. Contributors add a changeset file under `.changeset/` for user-facing changes.
2. A maintainer creates/updates the "Version Packages" PR by running `pnpm changeset version` and committing the result — or `npm run release:integrate`, which also commits and tags.
3. Pushing the `vX.Y.Z` tag (`npm run release:integrate:push`) starts the release; a push to `main` does not.
4. The workflow runs the full gate, then `pnpm run release`, which executes:
   - `node scripts/publish-workspace.mjs`
   - `node scripts/publish-angular.mjs`
5. Packages are published, each at the version its own `package.json` declares, with `--provenance`.
6. Nothing further is needed to make the release public.

Why manual PR creation: organization policy disables GitHub Actions PR creation/approval with `GITHUB_TOKEN`.

## Step 3: Post-setup verification

Run these checks after the first release:

1. The release job succeeds without npm token secrets.
2. Each package's npm version matches its `package.json` in the tagged commit.
3. Package metadata shows a provenance attestation.

Useful checks:

```bash
npm view @modyra/core version
npm view @modyra/angular version
npm view @modyra/core --json | grep -i attestation
```

A green job is already evidence of publication: both publishers poll the registry after publishing and fail when a package does not appear at its expected version.

## Step 4: Harden security after first success

After confirming OIDC trusted publishing works:

1. Confirm no `NPM_TOKEN` exists in repository secrets.
2. In npm package settings, restrict token-based publish access.
3. Keep 2FA enforced for maintainers.

## Troubleshooting

If publish fails with ENEEDAUTH or OIDC-related auth errors:

1. Re-check trusted publisher fields for exact match (`modyra`, `release.yml`, action `publish`).
2. Confirm release is running in `.github/workflows/release.yml` (not via a different caller workflow).
3. Confirm workflow still has `permissions: id-token: write`.
4. Confirm runner is GitHub-hosted and npm is ≥ 11.5.

If only some packages publish:

1. Verify a trusted publisher exists for each one; a missing publisher stops the run partway and leaves the registry holding some new versions and not others.
2. Re-run the same release — `workflow_dispatch` is enabled for this. The publishers skip what is already published and fail on version mismatches, so repeating is the intended repair.

If the run fails before publishing anything with "no longer matches the workspace":

`scripts/publish-workspace.mjs` found a public package it does not list, or lists one that is now `private`. Fix the list; the release published nothing.
