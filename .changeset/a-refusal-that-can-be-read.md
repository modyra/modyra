---
"@modyra/core": patch
---

A cross-field verdict that decides `valid` can be read

A form-level validator attributes its errors to field paths, and a keyed collection's paths are
data — a rule about rows names `rows.a.code`, computed from a server response or a list of ids. When
the row leaves while the rule still names it, or when the path never had a field at all, the error
kept deciding `state.valid()` and `state.canSubmit()` and was returned by no public read: not
`errorsFor` at its own path, not the form's own bucket, not the submit event.

A form that will not submit and cannot say why is the one state a consumer cannot render.

Such an error now surfaces at the form — `errorsFor("")` — which is where a *server* error whose path
matches no field has always surfaced, for exactly the same reason. Errors naming a live field are
unchanged: they read at that field, as before.
