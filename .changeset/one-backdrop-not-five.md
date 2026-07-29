---
"@modyra/styles": patch
"@modyra/angular": patch
---

One backdrop, not five names for it

Every adapter draws exactly one backdrop — `mdy-overlay-backdrop`, from the overlay panel — and has
since the panel took the job. The stylesheets had not caught up: `mdy-datepicker__backdrop`,
`mdy-timepicker__backdrop` and `mdy-select__overlay-backdrop` were still styled across the foundation,
Material and Angular's own timepicker sheet, matching nothing.

`mdy-datepicker__popup--modal` and `mdy-timepicker__popup--modal` went with them, including the whole
M3 dialog block keyed on the first. A modal panel wears `mdy-overlay-panel--modal`; the popup inside
it keeps its own name and never had the modifier. The `__modal-header`, `__modal-label` and
`__modal-value` parts *are* emitted and are untouched.

None of this changes a pixel: every rule removed was already matching nothing. What changes is that
the dead category of the contract-coverage audit is now **empty** — 116 allowlisted entries down to
111, and 30 fewer theme classes emitted by nobody.

The audit itself was part of the problem: it read class names out of CSS **comments**, so the note
explaining why a rule had been deleted kept the deleted rule alive in the report. It strips comments
now, exactly as it already did on the TypeScript side.
