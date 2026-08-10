---
"@modyra/angular": patch
---

The published type declarations no longer import a path from inside this repository.

`modyra-angular.d.ts` declared `import * as … from 'packages/core/dist/i18n'` — a module that exists
only in the Modyra workspace. A consumer's build stopped with `TS2307: Cannot find module
'packages/core/dist/i18n'` on any project that type-checks its dependencies, and the only workaround
was a `paths` entry in the consumer's `tsconfig.json` mapping that specifier onto
`@modyra/core/i18n`. Every release from 0.2.0 to 0.7.0 shipped it.

The declarations now name `@modyra/core/localization` and `@modyra/core/i18n`, both published entry
points. **If you added that `paths` remap, remove it once you are on this version** — it maps a
specifier the package no longer emits.
