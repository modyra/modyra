---
"@modyra/core": patch
---

Asking for strict either gets strict or gets told

`parseDynamicForm(document, { mode: "STRICT" })` — or a bare `"strict"` where the options object
belongs, or `null` — was read leniently and answered `ok: true`. A publishing gate asks for strict
precisely so a partly valid contract does not go out, and a typo in the request turned that gate into
a pass.

A mode this reader does not know is now reported (`MDY_DYNAMIC_UNKNOWN_PARSE_MODE`) and makes `ok`
false. It is a report rather than a throw, because this parser's whole design is a report.
