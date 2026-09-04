---
"@modyra/react": minor
"@modyra/vue": patch
---

`@modyra/react` draws the text-like kinds, and is judged by the conformance kit from its first
component rather than after the march.

`text`, `email`, `password`, `textarea` and `number` share an anatomy and differ in what they ask the
platform for, which the catalogue answers as `controlType`. Everything a widget owes — the parts,
their classes, the relations that make a control findable, the native input a kind declares — is read
from the projection the controller publishes.

Two things are React's own rather than the playbook's. `useId` means `widgetId` is optional here and
required in the Vue components: React can name a widget itself with an identity that survives a
re-render, and a host with its own scheme still passes one. And React spells DOM attributes
differently — `class` is `className`, `for` is `htmlFor` — so translating a declared part is a
mapping rather than a spread; a component that spread the contract's answer would set neither, and
would do it silently.

`@modyra/vue` re-exports `MdyDeclaredPart` from its entry. It was declared in a built module and
reachable from no door, which is a name a consumer can be told about and cannot write.
