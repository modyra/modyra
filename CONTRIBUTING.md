# Contributing

## Development setup

```bash
npm run setup          # install deps + build core/widgets/zod + the Angular package
npm test               # the whole matrix: core + adapters (zod, standard-schema,
                       # react, vue, lit) + widgets + Angular unit/type tests
npm run test:bundle    # tree-shaking proof
npm run demo:angular   # one demo per framework: demo:react / demo:vue / demo:lit
```

Node 22+, pnpm workspace (the npm scripts wrap it).

The repo is a **framework-agnostic monorepo**: `@modyra/core` and
`@modyra/widgets` are zero-dependency and must stay that way; each
framework binding (`angular`, `react`, `vue`, `lit`) is a peer package of
equal rank — new shared capability goes in the core, not in one adapter.
There is **no root `angular.json`**: the root is plain TypeScript tooling,
and every framework keeps its own toolchain inside its folder — the Angular
package builds with standalone `ng-packagr` and tests with
`jest-preset-angular` (`packages/angular/jest.config.cjs`), its
tree-shaking probe app lives in `packages/angular/bundle-test`, and the
Angular demo app is self-contained in `examples/angular` (own
`angular.json`, own scripts).

## Ground rules

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

## Where help is wanted

- Visual regression testing (the axe a11y spec and the Playwright smoke
  test already run; screenshot diffing does not).
- Locale presets beyond en/it/de/fr/es.
- Browser-based benchmark suite.

## Release process

1. Full test run (`npm test`), `test:bundle`, `pack:analyze`,
   `pnpm audit --prod` clean.
2. `npm run version` to apply changesets (bumps versions, updates
   CHANGELOG.md), commit, `npm run release` to publish.
   Release candidates precede majors.
