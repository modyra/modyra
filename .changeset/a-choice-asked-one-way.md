---
"@modyra/widgets": minor
"@modyra/angular": patch
"@modyra/lit": patch
---

Whether a held value is an option's is asked of one function

`sameChoice` is now exported from `@modyra/widgets`. It answers whether the value a field holds is a
given option's value: identity first, then the structural key for objects, so a fresh copy from a
draft, a refetch or an import is still the option it copies.

The Angular radio group and segmented button, and the Lit option widgets, now ask it instead of each
carrying their own copy. One case changes: an array held against a primitive option (`["b"]`
against `"b"`) no longer marks that option as chosen, because an array is not the string it
prints as.

No migration is needed unless a form relied on that coincidence.
