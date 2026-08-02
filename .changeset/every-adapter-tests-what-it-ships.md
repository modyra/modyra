---
"@modyra/core": patch
"@modyra/preact": patch
"@modyra/react": patch
"@modyra/svelte": patch
"@modyra/lit": patch
---

Every adapter's conformance suite runs the reactivity that package actually exports.

`@modyra/preact`, `@modyra/react`, `@modyra/svelte` and `@modyra/lit` each ship a named
`*Reactivity()` — core's graph re-tagged with their own `kind`, which the capability matrix
introspects. **Every one of their conformance files ran `vanillaReactivity()` instead.** The export
consumers import was covered by nothing, and a re-tag is a spread: the one shape that silently drops
a member.

It does now, plus a check that the re-tag still carries every member. Removing `createScope` from
one of them fails eleven tests; before this it failed none.

The backward-compatibility shim `core/test/reactivity-contract.mjs` is **gone**. It existed to adapt
the old `runReactivityContract(name, factory)` signature for "every adapter package's own
`test/reactivity.test.mjs`", and no adapter uses that signature any more. It also hardcoded
`destroy: () => {}` and an immediate flush, so nothing tested through it was ever asked to tear down
or to flush.
