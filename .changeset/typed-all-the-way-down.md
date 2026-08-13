---
"@modyra/angular": minor
---

A record row's own collection is typed all the way down.

`MdyItemHandleTree` now maps a `record` or `array` descriptor inside a row to this
framework's own handle types, so `form.f.orders.row(k).lines.row(k2).sku` carries
Angular's signals exactly like a top-level handle instead of resolving to `never`.
