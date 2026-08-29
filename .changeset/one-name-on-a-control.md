---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/angular": patch
---

One name on a control, decided once

Which attribute carries a control's name was a rule each renderer answered for itself, spelled out
at every element that needed it. Two names on one element is not two names: the computation takes
`aria-labelledby` and stops, so an `aria-label` beside it is text nobody will ever hear — and where
the two disagree, the one a developer reads in the source is the one that does not speak.

`fieldNameAttributes` answers it once and returns the attributes to apply, so the pair cannot be
written by accident: the caption where the field has one, the words it can offer otherwise, and
never both. The option projection, lit's group elements and Angular's radio and segmented renderers
all read it now instead of restating it. See ADR 0175.
