---
"@modyra/core": patch
---

An option `createForm` does not read is reported to the diagnostics sink when one was given, under
`MDY_UNSUPPORTED_ADAPTER_OPTION`, instead of only to the console. A consumer who supplies a sink
asked for these as events, and this was the one degradation that could reach nothing else — the first
thing a host wants routed, since a misplaced option looks exactly like not having asked.
