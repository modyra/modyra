---
"@modyra/core": patch
---

A stored draft holding a deeply nested value is dropped and reported like any other draft the form
will not take, instead of throwing out of `createForm`. `localStorage` is writable by any script on
the origin, and `JSON.parse` reads a deeply nested document without difficulty — so the value arrived
whole and the check for values a draft must not carry recursed once per level until the stack ended.
The application got no form at all, on every load, until someone cleared the key. The walk is
iterative, and costs a string in storage nothing to attempt.
