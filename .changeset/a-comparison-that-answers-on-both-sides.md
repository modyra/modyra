---
"@modyra/widgets": patch
---

`colorValueEquals` answers when either colour is missing

The left side was guarded (`left ?? ""`) and the right was not, so comparing against a colour nobody
has chosen threw a `TypeError` — including the easiest case, where neither side is set. Both sides
now accept `null` and `undefined`: two absences are the same colour, one absence is not the colour
opposite it.
