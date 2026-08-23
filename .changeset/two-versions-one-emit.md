---
"@modyra/lit": patch
---

The colours field compiles under both TypeScript versions.

`[...this.querySelectorAll(…)]` spreads a `NodeList`, which is iterable at runtime in every browser
this ships to and typed as iterable only when the `dom.iterable` lib is on. The newer compiler accepted
it and the older refused, so the normal build passed and only the emit-parity gate saw it —
`Array.from` says the same thing to both.
