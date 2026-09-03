---
"@modyra/widgets": minor
---

Declare the calendar's longer stride, which has shipped undeclared

`PageUp` turns a calendar to the previous month and `Shift`+`PageUp` to the previous year. The second
half has worked in every renderer since before this field existed, and the keyboard table said only
that these keys move a page — so a legend built from the table would have told a person the calendar
turns a month at a time, which is half of what their keyboard does.

`MdyKeyBinding` gains an optional `longStride`, set on the two page bindings of the kinds that draw a
calendar. It says that holding `Shift` makes the same movement take a longer stride, and deliberately
not how much longer — for the reason `page` does not say "a month": the unit belongs to whoever
carries the movement out, and a vocabulary shared by seventeen kinds should not learn one kind's
units to describe it.

Declared as a property of the act rather than as a second binding. `Shift` modifies the act
everywhere in this contract; only the platform's accelerator chooses which declaration answers a
press, so a held-key binding beside the bare one would be a rule nothing could reach — and the
custodian added alongside this would refuse it.

**A finding about the tooling, stated here because the classification is wrong and the disagreement
is the point.** `contract:diff` reports this as `patch`, "Contract unchanged", while declaring that
the keyboard is one of the four things it covers. A binding is recorded as `PageUp@open:move by=-1`:
key, phase, intent, `mod`, `by`, `on`, `focus`. `page`, `toEnd` and now `longStride` are not in the
snapshot at all. Measured, not inferred — removing `page` from `PageUp`, which turns a calendar's
month-turn into a plain move, also leaves the differ reporting "Contract unchanged". Shipped as
`minor` on the type surface's classification, which does see the new field.
