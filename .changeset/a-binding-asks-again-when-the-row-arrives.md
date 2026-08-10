---
"@modyra/core": patch
"@modyra/angular": patch
---

A control mounted before its row is declared now binds when the row arrives.

Rendering a keyed collection column by column means a cell can reach the DOM before whatever owns
the collection has declared its keys. The contract has always said such a control renders empty and
binds when the row arrives; in Angular it stayed empty forever, because whether a path is open is
answered from the collection's own set — deliberately not a signal, so that writes do not tie
unrelated computations to a collection's shape — and a binding that resolved its field once never
re-asked.

`MdyFormAdapter` now carries `fieldNames`, the membership signal the engine already maintained, as an
**optional** member: an adapter with no notion of membership has nothing to report, and a binding
reads its absence as "membership never changes". No existing adapter has to change. A binding that
finds no field depends on it only while it has none, so a bound control is not woken by every
registration in the form.

See ADR 0026, amendment "asking again when the row arrives".
