---
"@modyra/widgets": major
"@modyra/lit": patch
"@modyra/core": patch
---

A control draws the value the model was allowed to hold

`patchValue` is public, a draft is data, and a server's answer is data: a multiselect or a file field
can be handed a string, a number or an object. The engine's own shape gate is what should object —
the model holds it, the field is invalid, `canSubmit` is false — and that verdict only arrives while
the control is still drawing.

Two places read the value as a list without asking: `optionsWithUnrecognizedValues` guarded emptiness
where its singular sibling guards shape, and `@modyra/lit`'s multiselect and file elements mapped over
whatever they were given. Each threw from inside the effect that draws the widget, and an effect that
throws stops running — so the control kept whatever it was showing *before* the write, with
`aria-invalid="false"` and an empty error list. The person had nothing to read and nothing to correct.

A value that is not a list is now one value, which is what the singular form has always done. The
shape gate then has something to object to, visibly.

`optionsWithUnrecognizedValues`' `values` parameter widens to accept a bare value. The type-surface
audit classifies that major; my own reading is that widening a parameter breaks no caller, and the
stricter classification is the one that ships.

`evaluateRuleCondition` compares two calendar dates as dates. Text order agrees with calendar order
only while every part is zero-padded — `"2026-2-01"` sorts before `"2026-1-10"` — and a document
cannot reach that, because the parser refuses an unpadded date on a date field. This function is
published on its own, and a caller comparing a date out of their own model has no parser in between.
