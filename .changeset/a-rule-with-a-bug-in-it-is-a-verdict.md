---
"@modyra/core": patch
---

A rule with a bug in it is a verdict, not an outage

A synchronous validator that threw let the write through and made `state.valid()` throw instead — and
every later read, so the form could not be rendered. An `asyncValidators` function that threw before
returning a promise escaped the chain the same way, and an `asyncWhen` predicate that threw took
`createForm` with it.

Each now behaves like the `serverValidator` path that always worked: the thrown message becomes an
error on the field and the form stays readable, a predicate that throws lets the check run rather
than deciding, and the engine's own refusals (`MdyComputedWriteError` and its siblings) still
propagate by name. ADR 0090.
