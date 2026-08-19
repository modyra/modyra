---
"@modyra/widgets": patch
---

A file-rejection message renders whatever it is given rather than raising. Every language's
`fileRejected` called `.join` on its argument, so a host calling the message directly — a log line, a
translation check — got a `TypeError` and a control with no text at all, in that language only.
