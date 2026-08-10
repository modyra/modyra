---
"@modyra/widgets": patch
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/plain": patch
---

A select no longer erases a value its options do not contain.

It used to write `null` into the form the moment the control mounted with an unrecognised value —
consistent from the widget's point of view, and destructive from everyone else's. The case that
matters is a value that came from outside: an import carrying the name of a category that does not
exist yet is exactly what lets a person find the row and fix it, and it disappeared before they saw
it.

The value now stays in the model and is rendered as an option of its own, selected, labelled by the
value unless the application supplies a name (`[unknownOptionLabel]` in Angular). A value that
matches an option loosely — `"1"` against `1`, as one read from JSON does — is still normalised to
the option's own value. Nothing is added while the option list is empty, because options that have
not loaded are not a list that refuses the value.

**A value outside the list is now refused by rules, not by the widget**: pair the field with
`oneOf()` if it must be invalid. New in `@modyra/widgets`: `optionsWithUnrecognizedValue`, which is
the whole of what the three renderers share here.

If your application merged the orphan value into the option list to work around this, that code is
now redundant — and harmless, since the helper adds nothing when the list already contains the value.

See ADR 0029.
