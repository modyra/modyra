---
"@modyra/widgets": patch
"@modyra/plain": patch
---

A datepicker sends the date it holds, not the date it shows

What a form sent for a date field contradicted what the field itself answered: `01/02/2026` on the
wire against `2026-01-02` in the model, in the same instant, from the same control. A receiver handed
`01/02/2026` cannot tell the second of January from the first of February — and neither can the sending
side, because it is looking at a field that holds the right answer.

Not a defect of whichever renderer formats today. A control's text is a **presentation** of the value
and the value is not, so a name on that control sends the presentation the moment anybody formats
anything. The field now carries its value in an input of its own, as `select` and `multiselect`
already do, and the control carries no name at all.
