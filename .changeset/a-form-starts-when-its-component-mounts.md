---
"@modyra/vue": minor
"@modyra/solid": minor
"@modyra/svelte": patch
---

A form a component owns starts when the component mounts

`useVueForm` in a component's setup and `useSolidForm` inside an owner build the form inactive and
activate it on mount, as React and Preact's `useMdyForm` already do. A server render never mounts,
so draft storage, history recording and async validators no longer start on the server. Outside a
component or owner the form is active at once, as before. See ADR 0222.

**Migration.** A draft now restores, and async validators first run, after the component mounts
rather than during setup: code that read `hasDraft` or an async verdict synchronously in setup must
read it after mount. `createVueForm`, `createSolidForm` and `createSvelteForm` are unchanged. The
Svelte README shows how a component that renders on the server builds its form inactive and starts
it in `onMount`.
