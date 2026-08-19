---
"@modyra/core": patch
---

A form that has ended answers with one voice

A destroyed form reported `canSubmit() === true` while `submitValue()` answered `{}` — so
`if (form.state.canSubmit()) send(form.submitValue())` posted an empty payload from a teardown path —
and a write arriving in the same beat landed on the handle only, leaving a control showing a value and
an error about a form that held neither.

`canSubmit()` is now `false` once destroyed, `submitValue()` answers from what was captured at the
end as `getValue()` already did, and a late write is refused and reported. Reads still answer;
nothing throws. ADR 0091.
