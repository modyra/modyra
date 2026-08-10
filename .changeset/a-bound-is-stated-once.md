---
"@modyra/core": major
"@modyra/angular": minor
"@modyra/lit": minor
"@modyra/plain": minor
---

A numeric bound is stated once, and the control offers what the rule already says.

`min()` and `max()` now carry the bound they enforce, and a field reports the range its own
validators state through `MdyFieldState.bounds` and `MdyFieldHandle.bounds`. The number control of
every renderer offers that range at the keyboard unless the control narrows it: `[minValue]` in
Angular, the `min`/`max` attributes in Lit, `min`/`max` in a framework-free field config. Where two
rules bound the same field the tightest wins — each was added to exclude something.

Until now the range had to be written twice, once as a validator and once on the control, and
nothing checked that the two agreed. An application that wrote only the validators offered no
constraint at all at the keyboard; one that wrote only the control accepted the value and failed on
submit.

Also new: `integer()`, for a field that holds a count, an identifier or a quantity of things — `1.5`
used to report itself valid and fail wherever the value was finally parsed, with no field to name.
A bounded integer composes: `compose(integer(), min(0), max(255))`.

`minLength()` and `maxLength()` now accept `string | readonly unknown[] | null`. They already
tolerated empty at runtime; the type refused the `string | null` an optional text field actually
holds, and forced a cast.

**Breaking**: `MdyFieldHandle` gained a required `bounds` member. Every handle the library produces
has one, so reading code is unaffected; code that **constructs a handle by hand** — a test double, a
custom adapter — must add `bounds: computed(() => ({ min: null, max: null }))`, or the field state's
own `bounds` where it wraps one.
