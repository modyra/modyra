---
"@modyra/core": patch
---

The Rust and Java SDKs nest the way the engine does

[ADR 0043](https://github.com/modyra/modyra/blob/main/docs/architecture/0043-a-collection-nests-without-a-limit.md)
removed the one-positional-level rule from the engine, and the published SDKs kept enforcing it —
the same divergence the JSON Schemas carried, one layer further out and shipped as a package:

```
{"node":"array","item":{"node":"array", …}}     MDY_DYNAMIC_INVALID_ARRAY
{"node":"array","item":{"node":"record",
                        "item":{"node":"array", …}}}   MDY_DYNAMIC_INVALID_RECORD
```

An author whose document the runtime accepts was told by their SDK that it was invalid. Both now
accept a collection of either kind as a row, at any depth.

**Rust also carried the removed depth cap**, and its walk was recursive — where a document deep
enough would end the process rather than raise something a caller can answer. It walks over an
explicit stack now, with no cap, matching what the engine's own parser was changed to.

**Java's cap moves from 8 to 100 and is named for what it bounds.** Its walk is still recursive, so
the limit is about what this parser can process rather than about the contract — stated as such in
the code. A residual divergence remains at depths no arranged form reaches: the engine accepts more.

The `positional` flag that carried the old rule is gone from both rather than threaded through inert,
and each SDK's test for it now states the rule that replaced it, with a refusal it still makes
asserted in the same run.

Verified: `cargo test` 11 passed, `./mvnw test` 22 passed.
