# Contributing

## Development setup

```bash
npm run setup          # install deps + build core/widgets/zod + the Angular package
npm test               # the whole matrix: core + adapters (zod, standard-schema,
                       # react, vue, lit, solid, preact, svelte) + widgets +
                       # Angular unit/type tests + tested guide examples
npm run test:bundle    # tree-shaking coverage
npm run demo:angular   # one demo per framework: demo:react / demo:vue / demo:lit /
                       # demo:solid / demo:preact / demo:svelte
```

Node 22+, pnpm workspace (the npm scripts wrap it).

The repo is a **framework-agnostic monorepo**: `@modyra/core` and
`@modyra/widgets` are zero-dependency and must stay that way; each
framework binding (`angular`, `react`, `vue`, `lit`, `solid`, `preact`,
`svelte`) is a peer package of equal rank — new shared capability goes in
the core, not in one adapter.
There is **no root `angular.json`**: the root is plain TypeScript tooling,
and every framework keeps its own toolchain inside its folder — the Angular
package builds with standalone `ng-packagr` and tests with
`jest-preset-angular` (`packages/angular/jest.config.cjs`), its
tree-shaking probe app lives in `packages/angular/bundle-test`, and the
Angular demo app is self-contained in `examples/angular` (own
`angular.json`, own scripts).

### AI-assisted development

AI tools are used during development for exploration, implementation, review and repetitive maintenance work. They do not replace project ownership or verification.

Every accepted change is held to the same requirements regardless of how it was produced: the design must be understandable, the diff must stay focused, relevant behavior must be tested, limitations must be documented and a maintainer must review the result. Generated output is not accepted solely because it builds or passes a test.

For the project motivation and development approach, see [Project background](docs/project-background.md).

## Ground rules

- **Every architectural or security decision is an ADR.** Modyra is
  production- and security-grade: a decision recorded only in a commit
  message, a changeset or a code comment is not recorded. Write it in
  [`docs/architecture/`](docs/architecture/README.md) using
  [the template](docs/architecture/TEMPLATE.md) — including the check that
  fails if it is violated, and its security impact. `npm run test:docs`
  enforces the required sections, contiguous numbering, and that the record
  is indexed. Retire a decision by superseding it, never by editing it into
  agreement with the present. A changeset describes a release; a change that
  takes a decision needs both.
- **Every change ships complete**: code + tests + docs (`docs/guides/`) +
  demo usage where visible. A fixed bug gets a regression test that cites
  the issue it closes.
- A new feature needs a documented use case, must not be achievable by
  composing existing pieces, and its bundle and accessibility impact must
  be assessed (`npm run test:bundle`, `npm run pack:analyze`).
- Public API changes: run `node scripts/api-surface.mjs` after
  `npm run build:angular` and review the diff of the generated report — no
  accidental exports.
- Naming: `Mdy` prefix for classes/types, `MDY_` for DI tokens, `mdy`/
  `mdy-` in templates. Commit messages follow Conventional Commits.
- UI changes keep the widget keyboard/ARIA behavior documented in the
  guides; run a manual keyboard pass for touched widgets.
- Versioning is [changesets](https://github.com/changesets/changesets)-driven:
  any user-facing change adds a file under `.changeset/` (`pnpm changeset`).

### Three questions before a report

Three ways a report has actually gone wrong in this repository. Each is
answerable in a line, and they belong in any report that proposes a
direction rather than only stating an outcome.

- **Which existing question did I look for before building an instrument?**
  Two tools that learn the same fact separately disagree eventually, and on
  the day they do, nobody can say which is right. Look for the declaration
  both sides should be reading before writing a second reader.
- **What did I try to write before declaring it missing?** A gap reported
  without an attempt is a guess about difficulty. Write the smallest
  failing thing first: often the gap is elsewhere, and sometimes it closes.
- **Which part of this sentence is measured, and which is inferred?** Both
  are allowed. What causes damage is inference *dressed as a report* — it
  arrives already dressed, so the reader's own check passes it.

### Comments and documentation

- **Comments say what the code does, not how it came to be.** No change
  history, no "used to be", no account of how a problem was solved. That
  belongs in the commit message or the changeset.
- **A package does not name the packages derived from it.** `@modyra/widgets`
  is the framework-agnostic contract; `@modyra/angular`, `@modyra/lit` and
  `@modyra/plain` consume it. A comment in `widgets` citing one of them as
  its reference inverts that dependency in the reader's head, even though
  the import graph stays clean. Describe the behaviour the contract
  requires; if one adapter's approach is the reason, the reason is the
  behaviour, not the adapter.
- The same holds in reverse for anything shared: state what the rule is,
  not which consumer prompted it.

## Writing documentation

`docs/` is the source for the published site; `site/src/content/docs/` is generated by
`npm run docs:sync` and is never edited directly. Package READMEs stay self-contained, because npm
renders them on their own.

**Write to one of three registers**, and know which one you are in:

- **Learn** — a reader following along. Lead with a runnable example, explain the concept it just
  showed, state the limit last.
- **Reference** — a reader looking something up. Tables and signatures; no narrative.
- **Decide** — a reader assessing risk. Claim, evidence, cost, in that order.

**Stay framework-neutral in a general page.** An adapter may appear as an example, never as the
assumed reader. A page that is genuinely about one framework says so in its title and lives beside
the general one — `usage-modes.md` and `usage-modes-angular.md` are the pattern. `@modyra/core` and
`@modyra/widgets` documentation never names an adapter package; `npm run test:docs` enforces it.

**Say what is true of the published versions.** A status sentence names the packages it covers and
the version they are at, never a milestone — see
[ADR 0028](docs/architecture/0028-a-status-sentence-names-a-version.md). "Pre-1.0" and "toward 1.0"
are not descriptions of the present.

**Do not write these claims.** Each one is either unverifiable or false here:

> write once run anywhere · zero lock-in · every framework fully supported · enterprise-ready ·
> automatic WCAG compliance · no-code · production-ready, applied to any package below 1.0

**A number in prose is a claim.** Widget kinds, adapter counts, bundle sizes, benchmark results:
derive them from the source or from a script in this repository, and name the command that
reproduces them. A measurement carries its date and the version measured.

**A page is not a changelog.** No "re-measured after phase J", no "this session shipped", no
argument aimed at a reviewer. Why a decision was taken belongs in an
[architecture record](docs/architecture/README.md); what changed belongs in a changeset.

Before opening a pull request that touches documentation:

```sh
npm run test:docs                  # links, orphans, dependency direction, decision records,
                                   # abandoned status phrasings (ADR 0028)
npm run docs:sync && npm run docs:build
```

Adding, removing or renaming a page under `docs/` also means editing the sidebar in
`site/astro.config.mjs`, which is hand-maintained on purpose — `test:docs` fails if a page is listed
nowhere.

## Where help is wanted

- Visual regression testing (the axe a11y spec and the Playwright smoke
  test already run; screenshot diffing does not).
- Locale presets beyond en/it/de/fr/es.
- Browser-based benchmark suite.

## Release process

Releases run in CI (`.github/workflows/release.yml`) via
[changesets](https://github.com/changesets/changesets). The reasoning behind
the shape below is [ADR 0025](docs/architecture/0025-a-tag-publishes-and-nothing-else-does.md).

1. Every feature PR adds a changeset (see above).
2. A maintainer creates/updates the **"Version Packages"** PR (for example
   with `npm run release:integrate`), committing version bumps and tagging
   the release commit (`vX.Y.Z`), then pushes with
   `npm run release:integrate:push`.
   Equivalent manual flow remains valid: `pnpm changeset version` +
   lockfile/changelog update + commit + tag. Versions are **independent**
   per package: each `@modyra/*` moves by what its own changesets say, and
   the tag carries `@modyra/core`'s version.
3. `release.yml` triggers only on a pushed `v*` tag (not on every push to
   `main`), so ordinary commits never start a publish attempt — pushing
   the version-bump commit's tag (step 2's `release:integrate:push`) is
   what starts it: full gate (build, all test suites, bundle/tree-shaking
   check, theme parity, `pnpm audit --prod`), then `npm run release`
   **stages** every publishable `@modyra/*` package with `--provenance`
   (sigstore attestations link each tarball to the exact commit and
   workflow run).
4. A maintainer makes the staged versions public with proof of presence —
   `npm stage list`, then `npm stage approve <id>`, or the npmjs.com UI.
   Nothing is on the registry until that step.
5. Release candidates precede majors.
6. `npm run release:rehearse` is the local dry run — `npm publish --dry-run`
   for every package. It packs tarballs and contacts no registry, so a green
   rehearsal says the artifacts build, not that a release would authenticate.

### One-time npm setup (repo admins)

- Configure **trusted publishing** for every publishable `@modyra/*` package:
  npmjs.com → package settings → GitHub Actions publisher. The workflow
  authenticates with its OIDC token; no publish token is stored in GitHub
  secrets.
- Trusted publisher fields must match exactly:
  GitHub org/user, repository `modyra`, workflow filename `release.yml`,
  allowed action `npm stage publish`.
- Use GitHub-hosted runners only (self-hosted runners are not supported by
  npm trusted publishing).
- A package npm has never seen has no settings page and therefore no
  publisher: its first version is published once by an authenticated
  maintainer (`npm publish --access public`), and configured immediately
  after.
- Full admin checklist and troubleshooting:
  `docs/guides/release-admin-trusted-publishing.md`.
- Provenance requires publishing from this exact workflow; local
  `npm publish` is intentionally not the path.
- `scripts/publish-workspace.mjs` and `scripts/publish-angular.mjs` skip
  already-published versions and fail when a package does not reach the
  version its own `package.json` declares, so a partial publish can simply
  be re-run.
- `publish-workspace.mjs` refuses to start when its list is not exactly the
  non-`private` packages under `packages/` (minus `@modyra/angular`, which
  is published from its `ng-packagr` output).
