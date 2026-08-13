---
"@modyra/core": patch
---

A row's value is shaped by its template, not by which control mounted first

Declaring a row admitted the claims of controls waiting on it before the row registered its own
fields, so a cell someone had mounted early was created first — and the row's value came back with
its keys in that order. `{ note, code }` for a table whose second column happened to render first,
`{ code, note }` for the same schema rendered the other way.

The order is data: it is what a serialized payload carries, what a signature over that payload
covers, and what a snapshot test compares. Rows now register their fields from the template before
waiting claims are admitted, so the shape follows the schema and nothing about the rendering can be
read out of the value.
