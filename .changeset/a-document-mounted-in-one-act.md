---
"@modyra/plain": minor
"@modyra/core": patch
---

A document can be mounted in one act

`mountDynamicForm(container, document)` parses, applies the document's rules, and mounts — the three
steps a caller had to remember in order. Forgetting the middle one compiles, mounts, and leaves every
condition the document declared inert: the page looks obeyed.

**Strict, whatever the parser's default is.** A lenient parse returns what it could read and reports
what it could not, which is right for a reader and wrong for this door: the person reaching for a
one-call mount is exactly the one who will not read diagnostics. A document that lost a declaration
is refused here, naming what it lost and where.

The plain demo and the lab's dynamic panel both use it for the checkout their Rust service defines,
so the three-step version is no longer shown anywhere as the way to do it.

`MdyDeclaredRules` and `MdyRuleRefusal` are withdrawn from the public surface in the same unreleased
window they appeared in — rules are written inline, and a refusal is only ever read off
`buildDeclaredRules`, so neither name buys a consumer anything they do not already have.
