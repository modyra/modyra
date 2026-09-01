---
"@modyra/core": patch
---

The adapter guide says what answering a capability `false` costs

The guide listed the ten capabilities as a copied type dump — including `writableComputed`, a member
the interface does not have — and said nothing about what answering any of them means. An author
copying the type without understanding it writes `false` out of caution, which is the dangerous
direction: a `false` buys a conformance check out of running, silently.

Each flag now has a row, grouped by what answering it actually costs. The groups are measured, not
described:

- **read by the engine** — `effects` and `batching`. Answering changes behaviour: without `effects`
  an array field's reconciliation is not driven for you.
- **read only by the suite** — `signalEquality`, `computedEquality`, `deterministicFlush`,
  `directObservation`, `pureComputeds`. Each `false` costs exactly one conformance check.
- **read by nothing today** — `graphInspection` and `serverSnapshots`, whose consumers are planned;
  and `effectOwnership`, which **nothing reads at all** — not the engine, not the suite. Every
  adapter declares it and no code consults it.

A test holds the list against the type, so a capability added tomorrow fails until the guide says
what answering it costs.
