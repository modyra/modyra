---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/styles": patch
---

Make filtering part of the contract: an option a query does not match is projected as `hidden`
(plus a `--hidden` class) by the select and multiselect controllers, so every renderer filters
identically by applying the part instead of reimplementing the match. The theme stops its own
`display` from beating `[hidden]` on options and chips.
