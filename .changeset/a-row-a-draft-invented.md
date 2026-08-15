---
"@modyra/core": patch
---

A path is an instruction a row's shape can refuse

A draft is written flat and read back flat, and a row named by a path the collection does not have yet
is created to receive it — that is how a saved order gets its lines back. It also makes the path an
instruction, and a draft lives where every script on the origin can write it.

One extra segment was the whole attack. `lines.a.b.sku` asks for a row `a` holding a `b` holding a
`sku`; there is no row `a` and no `b` inside a row, and both were made. The collection then held a row
of a shape its own template never described, and with no field there to be invalid the form reported
itself **valid, submittable and without errors** — while `submitValue()` threw `Flat patch does not
match schema shape` and `submit()` threw a raw `TypeError` from inside the engine.

A collection now creates a row for a path only when its template declares the cell that path names: a
group answers for its named children, a field for nothing below it, and a nested collection for its own
subtree. A path the template does not declare is ignored and named in a development warning, rather
than thrown — a form that refuses to open because storage holds a bad key is a denial of service with
extra steps.

An honest draft is unaffected: the row and its value come back as before.
