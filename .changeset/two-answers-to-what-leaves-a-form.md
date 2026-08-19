---
"@modyra/core": patch
---

`getChanges()` withholds a field that is out of play, as `submitValue()` does

Both answer *what leaves this form*, and they disagreed: a field taken out of play — by a document's
rule, by `setDisabled`, or by `setInactive` — was withheld from `submitValue()` and carried by
`getChanges()`, so a PATCH built the documented way sent exactly the value a submission refuses to.

The value is still held and still reported by `getValue()`, which is the total read.
