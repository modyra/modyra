# Trusted Publishing Admin Runbook

One-time setup and release operations for npm Trusted Publishing with GitHub Actions, integrated with Changesets.

## Scope

This runbook is for npm/package admins and repository admins who manage release security and publication settings.

## Preflight (must match repository state)

Verify these files before setting publishers on npmjs.com:

1. `.github/workflows/release.yml`
   - runs `pnpm run release:stage`
   - workflow permissions include `id-token: write`
   - no `NODE_AUTH_TOKEN` / `NPM_TOKEN` in publish env
2. `package.json`
   - includes `version: changeset version && pnpm install --lockfile-only`
   - includes `release:stage` script
3. `.changeset/config.json`
   - `baseBranch` is `main`
   - `fixed` includes `[@modyra/*]` so versions stay coherent

If any of these checks fail, stop and align the repo first.

## Step 1: Configure npm Trusted Publisher

Repeat for each package under `@modyra/*`:

1. Open package on npmjs.com.
2. Go to Package Settings, then Trusted Publishing (or Publishing Provider).
3. Select provider: GitHub Actions.
4. Fill fields exactly:
   - Organization/User: your GitHub org or user
   - Repository: `modyra`
   - Workflow filename: `release.yml`
   - Environment name: leave empty unless your workflow uses GitHub Environments
   - Allowed actions: enable `npm stage publish`
5. Save.

Notes:

- Field values are case-sensitive.
- Trusted publishing supports GitHub-hosted runners only.
- Each package has one trusted publisher configuration at a time.

## Step 2: Changesets release flow (what to expect)

This repo is Changesets-driven:

1. Contributors add a changeset file under `.changeset/` for user-facing changes.
2. A maintainer creates/updates the "Version Packages" PR by running `pnpm changeset version` and committing the result.
3. When the "Version Packages" PR is merged, the release workflow runs full checks.
4. The workflow runs `pnpm run release:stage`, which executes:
   - `node scripts/publish-workspace.mjs --stage`
   - `node scripts/publish-angular.mjs --stage`
5. Artifacts are staged, not immediately public.
6. A maintainer approves stage with 2FA (`npm stage approve` or npmjs.com UI).

Why manual PR creation: organization policy disables GitHub Actions PR creation/approval with `GITHUB_TOKEN`.

## Step 3: Post-setup verification

Run these checks after first staged release:

1. CI release job succeeds without npm token secrets.
2. npm shows staged releases for all `@modyra/*` packages.
3. Stage approval publishes all packages at the same version.
4. Package metadata shows provenance attestation when supported.

Useful checks:

```bash
npm view @modyra/core version
npm view @modyra/angular version
```

## Step 4: Harden security after first success

After confirming OIDC trusted publishing works:

1. Remove `NPM_TOKEN` from repository secrets (if still present).
2. In npm package settings, restrict token-based publish access.
3. Keep 2FA enforced for maintainers approving staged releases.

## Troubleshooting

If publish fails with ENEEDAUTH or OIDC-related auth errors:

1. Re-check trusted publisher fields for exact match (`modyra`, `release.yml`).
2. Confirm release is running in `.github/workflows/release.yml` (not via a different caller workflow).
3. Confirm workflow still has `permissions: id-token: write`.
4. Confirm runner is GitHub-hosted.

If only some packages publish:

1. Verify trusted publisher exists for each `@modyra/*` package.
2. Re-run the same release; publisher scripts are idempotent and fail on version mismatch by design.
