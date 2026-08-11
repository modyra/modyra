---
"@modyra/core": patch
"@modyra/angular": patch
"@modyra/vue": patch
"@modyra/solid": patch
---

A computed derives a value and writes nothing — the rule is now in the reactivity contract.

The vanilla graph allowed a signal to be written inside a `computed`; another reactivity the engine
runs on refuses that outright. So shared code could pass every test on one adapter and throw under
another — the cross-framework variation this contract exists to prevent. Nothing in `@modyra/core`
or `@modyra/widgets` was doing it, checked across every computed in both.

Writing a signal while a computed recomputes now throws `MdyComputedWriteError`. `untracked` does not
lift the ban — it says "do not depend on what I read", not "this is no longer a computed" — and an
**effect** is unaffected: acting on a change is what an effect is for, including one that runs while
a computed is being read.

**Breaking for anyone implementing `MdyReactivity` outside this repository**:
`MdyReactivityCapabilities` gains a required `pureComputeds`, so an adapter will not compile until it
answers. Report `true` only if the graph actually refuses the write; `false` means it will not
notice, and is never permission to do it. The shipped adapters answer: vanilla `true` (it enforces),
Angular `true` (Angular enforces it itself), Vue and Solid `false`.

See ADR 0032.
