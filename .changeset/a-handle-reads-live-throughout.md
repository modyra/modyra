---
"@modyra/core": patch
---

`has()` and `validOf()` on a record handle answer inside a computed.

Both read the declared-key set, which is deliberately a plain `Set` — the path gate consults it from
the engine's write paths, where touching a signal would tie an unrelated computation to a
collection's shape. That is right for the gate and wrong for a caller: a template writing
`rows.has(key)` got the answer that was true when it first ran and never another one, and the first
read being correct is what made it hard to notice.

They now read the key signal to depend on it and the set to answer it, so the cost is unchanged and
every member of the handle reads live.
