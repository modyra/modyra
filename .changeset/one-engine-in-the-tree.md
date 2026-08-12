---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/react": minor
"@modyra/vue": minor
"@modyra/solid": minor
"@modyra/preact": minor
"@modyra/svelte": minor
"@modyra/zod": minor
"@modyra/standard-schema": minor
"@modyra/eslint-plugin": minor
---

A package depends on its siblings by range, so a tree holds one engine instead of two.

Every package except `@modyra/angular` pinned its siblings at an exact version. The packages version
independently, so a release that lands partially — as 2.1.1 did — is enough to install the engine
twice:

```
npm install @modyra/plain@0.7.0 @modyra/widgets@2.0.2
→ node_modules/@modyra/core                               2.1.0
→ node_modules/@modyra/widgets/node_modules/@modyra/core  2.1.1
```

And two copies of `@modyra/core` are two engines. The engine keeps module-level symbols and
registries, so a `required()` built by one is **not required** to the other: `MDY_MARKS_REQUIRED` and
`MDY_VALIDATOR_FACTS` do not match across the boundary, and `aria-required` — along with every
declared constraint — stops crossing it. That is what ADR 0030 exists to prevent, arriving through
packaging instead of code.

Sibling dependencies are now `^` ranges, which is what `@modyra/angular` already published and what a
package manager deduplicates. `npm run test:tarballs` installs everything this repository publishes
into a clean consumer and counts the copies: more than one fails the gate, naming the paths.

Nothing changes for a consumer who installs a matched set. A consumer holding an older adapter now
gets engine patches instead of being pinned away from them.

See ADR 0033.
