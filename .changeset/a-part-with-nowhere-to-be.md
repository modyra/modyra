---
"@modyra/widgets": patch
---

A mandatory part whose parent is declared absent is not missing

Thirteen parts are mandatory under a parent the contract makes optional. Eight live inside an
overlay, and the kit already knew a closed picker is not hiding its calendar. The other five sit
under `documentDeclaresIt` and `kindOffersIt` parents — a checkbox's `indicator` lives under its
`label`, which a document with no caption may legitimately not have — and those were reported as
`PART_MISSING`: a renderer asked for an element and refused the place to put it.

A part whose declared parent is absent is excused, by the same walk the kit already used to decide
that such a parent may be declared absent at all.

The line is a *declaration*, not an absence. A parent that is merely not in the DOM excuses
nothing, so a renderer cannot quietly drop a subtree and have the kit agree.
