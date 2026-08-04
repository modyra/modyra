---
"@modyra/widgets": patch
---

The type-surface audit records exported function signatures.

Finding K's last half. The projections — `projectFieldA11y` and its seven siblings — each return an
inline type literal naming the parts they hand back, so "which parts does a renderer receive" was a
fact the declarations already carried and nothing read. Withdrawing one classified as `patch`.

Each parameter is now recorded by position and by name, with its type, and so is the return type.
Position matters as much as name: renaming a parameter breaks nobody, while reordering two of the
same type breaks every caller silently. 310 exported shapes became 544.

No API changes — this is the check, not the thing checked.
