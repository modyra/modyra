---
"@modyra/core": patch
---

The cross-runtime guard survives a second copy of the package

`observerFor` catches a binding observing a handle through a runtime that does not own it, by reading
a module-level `WeakMap` of owners. A module-level map is per module *instance*: two copies of
`@modyra/core` in one dependency tree — what a package manager builds whenever two dependents need
versions it cannot deduplicate — are two registries, so a handle registered in one is unknown to the
other. `observerFor` reports only when it can see an owner that differs, so an unknown handle is one
it says nothing about, and the guard turned itself off in exactly the tree it exists for.

The registry is now keyed by `Symbol.for("modyra.handle-registry")`, so every copy loaded in one
realm shares one pair of maps, and read defensively so a copy of another version with a different
shape is not trusted. See ADR 0105.
