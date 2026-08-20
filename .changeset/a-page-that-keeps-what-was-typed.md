---
"@modyra/plain": minor
---

`mountMdyForm` takes a `draft` option

Draft persistence is a headline of the engine — debounced autosave, restore on load, field exclusion,
four claims — and it is the *form's* option. This renderer builds the form itself and had nowhere to
put it: `mountMdyForm(container, fields, { draft: { key } })` was accepted without a word and nothing
was ever written. The other renderer takes its options straight to the form, so the same call kept a
draft there, which is what made this a missing slot rather than a feature that does not work.

`draft` is now passed to the form this mount builds, as `createForm` takes it — a key or the whole
`MdyDraftOptions`.
