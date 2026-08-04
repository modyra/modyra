---
"@modyra/core": major
---

A reactivity says what it is.

`MdyReactivity.id` and `.kind` were optional, marked "optional until every adapter is migrated". Every
adapter has been migrated for some time: `vanilla`, `vue`, `react`, `solid`, `preact`, `svelte` and
`angular` all declare both, measured by calling each factory and reading the fields.

They are required now. 1.0 should not freeze an interface that describes a migration which is over —
an optional field every implementation supplies is a field consumers must still write a branch for.

- **`id`** identifies a reactivity by symbol rather than by name. Two adapters can both call
  themselves `"react"`; only the symbol says whether they are the same one. The headless adapters
  share vanilla's symbol deliberately — they *are* vanilla underneath.
- **`kind`** is what it calls itself, for diagnostics.

**Migration:** an implementation of `MdyReactivity` written outside this repository must add both.
Every adapter shipped here already has them, so nothing changes for anyone consuming one.

**Classification.** `contract:diff` reports `patch` — it snapshots the widget catalogue and cannot
see the reactivity interface. Shipped as `major`: a required field added to an interface consumers
implement is exactly the asymmetry `docs/contract-compatibility.md` calls major.
