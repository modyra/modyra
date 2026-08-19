---
"@modyra/core": minor
---

A draft is not replaced by one belonging to another form

Two live forms sharing a draft key meant the last save took the whole envelope: one person's typing
was gone from the only place it was kept, in silence, and reopening their form restored nothing
because the draft under their key described fields they did not have.

A form now refuses to replace a stored draft holding paths it does not declare, reports
`MDY_DRAFT_KEY_IN_USE` once, and leaves the other form's work where it is. Restoring is unchanged,
and a form reopening its own draft — or a second tab of the same form — still replaces it. ADR 0088.
