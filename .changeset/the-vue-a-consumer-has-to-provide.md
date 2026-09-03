---
"@modyra/vue": patch
---

Declare `vue` as the peer dependency it has become

The package's published declarations import `vue`, and its manifest never said so. A consumer
installing from the tarballs could not type-check what we ship: `Cannot find module 'vue' or its
corresponding type declarations`, in every file of the new components.

It went unnoticed because the package was headless until this release — it depended on
`@vue/reactivity` alone, which was the honest shape for composables over a form handle and stopped
being one the moment a component rendered.

Declared the way its five siblings declare theirs: a permissive `peerDependencies` range plus a
concrete `devDependencies` pin. React, Lit, Svelte, Preact and Solid all carry that pair, so this is
the house form rather than a new one.
