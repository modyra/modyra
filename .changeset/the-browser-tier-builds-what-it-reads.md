---
"@modyra/core": patch
---

The browser battle tier builds the engine before reading it

`battle:browser` and `battle:browser:ci` began at `build:plain`, which compiles widgets and plain and
not core. On a fresh checkout — which is every CI run — `@modyra/core` had no `dist`, so the browser
tier failed at its first compile with 81 "Cannot find module '@modyra/core'" errors and never reached
a battle. Locally it passed because a previous build had left the directory there, which is the same
trap the node tier's own gate exists to catch.

Both scripts now build core first. Measured with `packages/core/dist` moved aside: 81 errors before,
0 after.
