---
"@modyra/core": minor
"@modyra/solid": patch
---

A runtime that declares no comparator decides change with `Object.is`

The published conformance suite had a case for a *declared* `equal` and none for the comparison a
runtime makes when nothing is declared, so `===` and `Object.is` were both conformant. They differ on
two values: `===` calls `0` and `-0` the same and `NaN` different from itself, so a number field
written `-0` over `0` re-renders nothing and one holding `NaN` re-renders on every write of the same
`NaN`.

`runReactivityContractTests` now requires `Object.is`. An adapter for a runtime whose native default
is `===` must override it — `@modyra/solid` did not, despite a comment claiming otherwise, and now
passes `Object.is` to `createSignal` and `createMemo`. Vue, React, Preact and Svelte were measured
and already agreed.

An adapter outside this repository that ran the suite and passed may now fail; the failure predates
the case. See ADR 0104.
