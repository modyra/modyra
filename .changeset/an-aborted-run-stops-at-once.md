---
"@modyra/studio-preview": patch
---

The preview's mock server honours a signal that is already aborted.

Its wait listened for `abort` but never asked whether the signal had already been aborted when the
run started, so a superseded run waited out the whole delay and then **succeeded** — returning a
verdict for a value nobody was asking about any more. Aborting halfway already worked.

The engine discards a late result either way, so a real form never showed the difference. What it
cost was the preview's honesty: `ctx.signal` is the contract an async validator is handed, and a
stand-in server that ignores it teaches the preview something the runtime does not do. The abort
listener is also removed when the wait ends normally, instead of being left registered.
