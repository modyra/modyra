---
"@modyra/core": patch
---

The skipped-check shape is read, not named

`MdySkippedReactivityCheck` was exported alongside the ledger it describes and is withdrawn again in
the same unreleased window — it was never in 2.5.0, so no consumer could have taken it.

`MdyReactivityTestHarness` stays exported because it is a parameter type: a consumer constructs one,
so it has to be nameable. A skipped check is only ever read, off `reactivityContractLedger()`, where
its shape arrives structurally. The name bought a reader nothing they did not already have, and the
smallest public surface wins.
