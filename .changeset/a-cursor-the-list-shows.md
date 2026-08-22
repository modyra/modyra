---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/styles": patch
---

The reading position in an option list is visible

A multiselect's cursor was announced through `aria-activedescendant` and drawn by nobody. Lit and
Angular each set `mdy-chip--active` on the option the keyboard stands on — a class the catalogue never
declared and no stylesheet drew — and plain set nothing at all, because it applied the projected part
and then wrote a locally built class list over it.

`multiselect.option` now declares the `active` state, the projection emits it for the option
`activeKey` names, plain stops overwriting what it was given, and the theme draws it. Renderers
already using the class keep working unchanged; one that draws its own cursor should drop it in favour
of the part's.
