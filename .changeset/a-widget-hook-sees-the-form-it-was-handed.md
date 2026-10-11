---
"@modyra/solid": minor
"@modyra/vue": minor
"@modyra/svelte": minor
---

A widget hook follows the form it was handed, and `destroy()` lets go of everything it started

`useMdyField` observes its handle through the runtime that owns the handle's signals (`observerFor`),
as the React and Preact hooks already do. Before, a Solid or Vue field hook given a handle from a form
built on another runtime never updated after the first read.

`destroy()` on `useMdyField` now releases the hook's own effect as well as its controller, so a hook
created outside a component or effect scope can be released. `useMdySelect` gains `destroy()` in all
three adapters; inside a component or scope it is still called for you. Both are idempotent.

**Migration.** None. Code that implements `MdySolidSelectApi`, `MdyVueSelectApi` or
`MdySvelteSelectApi` by hand must add `destroy()`.
