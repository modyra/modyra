---
"@modyra/vue": patch
"@modyra/svelte": patch
"@modyra/solid": patch
---

The reactivity binding gets a module of its own

Three packages declared their binding to the host's reactivity in the package
entry, and the entry re-exports the widget hooks — so a hook reaching for the
binding imported the entry that exports it. Six module cycles, the same ring
three times.

The binding moves to `src/reactivity.ts` in each, as `@modyra/core` did with
its own, and both the entry and the hooks import it from there. Nothing about
the published surface changes: the entry still exports every name it exported.
