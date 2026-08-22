---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

One default colour palette, in the contract

Each renderer carried its own list of suggested colours — eight in plain, fourteen in lit, ten in
Angular — so the same document drew a different palette depending on which adapter rendered it, and
none of the three was the one the library suggests. `MDY_COLOR_PRESETS` is now published from
`@modyra/widgets`: eight hues around the wheel and two neutrals, which all three consume.

Migration: a field that passes its own `presets` is unaffected. A field that relies on the default
gets the declared palette, which differs from what plain and lit drew before.
