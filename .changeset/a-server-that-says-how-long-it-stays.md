---
"@modyra/core": patch
---

The demo API server says how long it intends to stay

The Rust example server now holds a lease per client. `--linked`, which the demo launcher passes,
means it leaves once every lease has expired; started without the flag it accepts leases and ignores
them for that purpose, so a person testing the API keeps their server.

Leases are named and idempotent — the same demo started twice is one reason to stay, not two — and
`GET /health` reports `{mode, leases, willExitWhenLeasesEnd}`, so the regime is read rather than
inferred from how the process was started. A linked server that leaves says why.

Three conditions end a linked server and all three are needed: the regime, at least one lease ever
held, and none live. The middle one is what keeps a linked server alive between binding its port and
the launcher's first lease.
