# Contributing

## Development setup

```bash
npm run setup        # install deps + build the library
npm start            # demo app at localhost:4200
npm test             # 16 suites (unit + compile-time type tests, zoneless)
npm run test:bundle  # tree-shaking proof
npm run build:lib    # all four entry points
```

Node 22+, pnpm workspace (the npm scripts wrap it).

## Ground rules

- **Every change ships complete**: code + tests + docs (`docs/guides/`) +
  demo usage where visible. A fixed bug gets a regression test that cites
  the issue it closes.
- A new feature needs a documented use case, must not be achievable by
  composing existing pieces, and its bundle and accessibility impact must
  be assessed (`npm run test:bundle`, `npm run pack:analyze`).
- Public API changes: run `node scripts/api-surface.mjs` after
  `npm run build:lib` and review the diff of the generated report — no
  accidental exports.
- Naming: `Mdy` prefix for classes/types, `MDY_` for DI tokens, `mdy`/
  `mdy-` in templates. Commit messages follow Conventional Commits.
- UI changes keep the widget keyboard/ARIA behavior documented in the
  guides; run a manual keyboard pass for touched widgets.

## Where help is wanted

- Playwright component-test harness for the renderer catalog (unblocks
  axe and visual testing in CI).
- Locale presets beyond en/it/de/fr/es.
- Browser-based benchmark suite.

## Release process

1. Full test run, `test:bundle`, `pack:analyze`, `pnpm audit --prod` clean.
2. Bump the version (semver), update CHANGELOG.md.
3. `npm run build:lib`, `npm pack` from `projects/modyra/dist`, publish.
   Release candidates precede majors.
