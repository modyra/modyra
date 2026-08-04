---
"@modyra/core": patch
"@modyra/widgets": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/react": patch
"@modyra/preact": patch
"@modyra/solid": patch
"@modyra/svelte": patch
"@modyra/vue": patch
"@modyra/zod": patch
"@modyra/standard-schema": patch
---

These packages are now compiled by TypeScript 7.

Nothing about the published API changes, and that is checked rather than asserted: both compilers
emit all twenty-one projects and the results are compared file by file. Across 464 files the only
difference is the order in which the members of a string-literal union are printed in
`catalog.d.ts` — the same type either way. The contract snapshot is unmoved, and the Angular package
still builds through its own TypeScript 5.9 toolchain from these declarations.

The Angular package and Studio's embedded compiler stay on TypeScript 5.9, which their peer ranges
and its package exports require.
