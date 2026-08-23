---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/styles": patch
---

A date range's two ends carry a class each, so a sheet stops counting `<input>` elements.

`startControl` and `endControl` are two declared parts and they carried the same two classes, so the
only way to round the left end of the pair was `:first-of-type` — a rule that counts elements of a tag
while reasoning about a class. Put a hidden native input or a sizer of the same tag in the group and
the rounding moves to the wrong end.

Each part gains a class of its own — `mdy-daterange__input--start`, `mdy-daterange__input--end` — and
the three renderers take their classes from the contract rather than repeating a string. The two
positional rules, in the base sheet and in the iOS theme, name the end they mean.

Additive: both parts keep the classes they had.
