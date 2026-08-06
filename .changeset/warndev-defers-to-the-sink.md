---
"@modyra/core": patch
---

A collected diagnostic is no longer also written to the console.

`parseDynamicForm` installs a sink and returns every finding in
`result.diagnostics`, which is the channel its callers read. It was also writing each one to
`console.warn`, so a caller that asked for the findings got them twice — once where it looked and
once where it did not. A tool parsing a document per keystroke turned that into a stream.

`warnDev` now writes to the console only when nothing is collecting. `parseDynamicFields` installs no
sink and is unchanged: there the console is the only channel a dropped field has, which is what the
dev-mode warnings in the guides describe.

Migration: a caller relying on `parseDynamicForm` to log is reading `result.diagnostics` instead —
each entry carries `code`, `severity`, `path` and `message`, which is more than the console line had.
