---
"@modyra/core": minor
---

The reactivity suite says which checks it could not perform

Ten of its checks return early when an adapter's capabilities make them unperformable. Skipping is
correct — a runtime that does not batch cannot be asked to prove it batches — but a check that
returns early reports as a passing test, so the number a runner prints is the number of checks
registered rather than the number of questions answered.

`reactivityContractLedger()` names every check registered and every one that could not be performed,
with the declaration that bought it out. The core suite prints it:

    reactivity contract: 14 of 15 checks performed
      not performed — vanillaReactivity: a declared computedEquality is actually honoured
          because capabilities.computedEquality or capabilities.effects is not true

Fifteen greens, fourteen answers. `computedEquality: false` is an honest declaration and always was;
what is new is being able to see which conformance it bought out of.

Printed rather than asserted: which capabilities an adapter has is its own business, and a threshold
would be the suite having an opinion about that. What is not negotiable is that the difference is
visible.

On `@modyra/core`: `reactivityContractLedger` and `resetReactivityContractLedger`.
