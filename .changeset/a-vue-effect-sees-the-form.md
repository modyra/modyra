---
"@modyra/vue": patch
---

A Vue `computed`, `watch` or `watchEffect` now tracks form state

`@modyra/vue` takes its reactivity from `vue` and no longer declares `@vue/reactivity` as a peer
(ADR 0220). When the adapter's `@vue/reactivity` resolved to a different version from the copy inside
`vue`, the two runtimes could not see each other. A consumer's own `computed`, `watch` or
`watchEffect` then read a field once and never updated, with no error.

**Migration.** None required. `vue` was already a required peer. A direct `@vue/reactivity`
dependency that a project added only for this adapter can be removed.

**On the classification.** `contract:diff` reports `patch` because it covers the widget contract
only. Removing a peer is visible in package metadata but removes nothing a working install used, so
`patch` is our reading too.
