---
"@modyra/vue": patch
---

`@modyra/vue` compiles under TypeScript 5.x again.

`querySelectorAll` returns something array-like that is not iterable unless a project asks for the
`DOM.Iterable` lib, and none of this repository's packages do — all nine declare exactly
`["ES2022", "DOM"]`. Spreading its result compiled under the compiler this package is built with and
failed under the one a consumer may hold, so `@modyra/vue` could not be built by anyone on the 5.x
line. That is portability, not style.

`Array.from` does not depend on the lib, and it is what every other package here already uses: 41
uses against no other spread over anything from the DOM. Adding `DOM.Iterable` instead would have
moved the whole package's type surface and made this the only package configured differently.

Found by `test:typescript7`, which exists to make the two compilers look at each other, and is the
only place they do.
