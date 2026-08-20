---
"@modyra/core": patch
---

A form does not restore a draft belonging to another form

A stored draft records the shape of the form that wrote it, and the write side reads it: a form
refuses to overwrite an envelope whose shape is not its own. The read side never looked, so the draft
the writer had declined to replace was the one the reader restored — one person's unsent text
appeared pre-filled in another person's form, and was submitted from there. Nothing was tampered
with: both envelopes were written by this library and both shapes were recorded.

Restore now asks the same question. The entry is left where it is rather than removed — it belongs to
another form, which can still read it — and the write side then refuses the key under
`MDY_DRAFT_KEY_IN_USE`. An envelope recording no shape is still restored: it is this form's own
earlier work as far as anything can tell. See ADR 0107.
