---
"@modyra/widgets": minor
---

The contract declares how a checkbox comes by its name

`MDY_WIDGET_RELATIONS` declared `label[for] → control` for fifteen kinds and omitted it for checkbox
and toggle, with a comment saying those two wrap their input in the label instead.

They do not. Measured in both renderers: the label carries `for`, the input carries the id, and
nothing wraps — the same association every other kind makes. The contract described a pattern nobody
implements, so a renderer built from the specification alone learned nothing about how a checkbox is
named, while the conformance kit went on demanding the association the renderers actually make.

Both are now declared. `contract:diff` calls it `minor` against the released tag and against the
working snapshot alike: a relationship added, not a version's meaning changed.
