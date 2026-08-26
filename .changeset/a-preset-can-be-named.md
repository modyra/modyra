---
"@modyra/core": major
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A colour preset can carry the name it is known by

A hexadecimal is not a name. Read out, `#4361ee` is six characters somebody has to hold in their head
to compare with the next one — so a panel of ten was, to anyone who could not see it, ten strings that
differ in the middle.

`presets` now takes `{ value, label }` as well as a string, and the renderers announce the label.

**This library ships no names for its own defaults, deliberately.** A generic palette naming `#4361ee`
would be guessing, and an approximated colour name is worse than the hexadecimal because it claims a
meaning it does not have while the hexadecimal claims none. The knowledge lives where the palette
does: a team's colours have names, and this is where they say them. An entry with no label is still
announced by its value — poor, and honest.

**Migration.** `MdyDynamicColorsField["presets"]` widens to `ReadonlyArray<string | MdyColorPreset>`.
A document that writes strings is unaffected; code that *reads* a parsed document and assumed
`string[]` now has two shapes to answer, and `colorPresetsOf` normalises either into value and name.
