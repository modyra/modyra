---
"@modyra/core": patch
---

A `disabled` or `readonly` binding survives the row it was made on

A keyed collection lets a control bind before its row is declared — a cell handle exists and stays
inert until the key arrives, and a claim waits with it. What a control said about the field did not
wait: `setDisabled` and `setReadonly` lived on the field record, which the row owns, so the binding
was dropped when the row arrived and again whenever a row was removed and re-declared under a
control that never moved.

The result was a field the binder believed was disabled, enabled and **submitted**. That is a
payload difference, not a cosmetic one.

Bindings are now kept beside the record, keyed by path, and re-applied to every record built for that
path. They last as long as something is bound there — a claim, or a claim waiting for its row — and
are released with the field when nothing is.
