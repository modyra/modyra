---
"@modyra/widgets": patch
---

The contract record carries every field a key binding declares, not three of them

`contract:diff` recorded a binding as `key@phase:intent`. Everything else a binding says — which part
answers it, what may be held with it, which way a move goes, where focus lands afterwards, what gates
it — was outside the record, so changing any of it was a change the differ could not report.

Found by changing one: `Escape` gained `modifier: "any"`, which decides whether somebody can leave a
panel with a modifier held, and the differ answered `patch`.

A binding is identified by its gesture and the rest are compared as that gesture's attributes.
Compared as one string instead, enriching the record reads as every binding removed and a different
one declared — eighty findings with a real removal invisible among them, which is the failure the
entry exists to prevent. A baseline written before the attributes existed has none for any binding,
and an absence there means "not written down" rather than "declared nothing", so the attribute
comparison is skipped against one — a guard that removes itself with the next snapshot.

Two mutations that used to pass now classify major: removing a modifier declaration, and removing a
binding outright.
