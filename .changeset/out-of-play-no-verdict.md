---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A field the form is not asking about no longer paints as failing.

A disabled field — by a binding, or inside a section a condition has closed — is **not validated by
the form**: `form.state.valid()` ignores it. Every renderer painted it anyway, so a closed section of
empty required fields was a block of red boxes for something nobody was being asked, while the form
reported itself valid. The form was right and the screen was misleading.

*Out of play, no verdict.* A disabled field reports no failure to show: the wrapper takes no error
modifier, the label no `has-error`, `aria-invalid` reads `false`, and the message is not rendered.

The rule is one function in `@modyra/widgets` — `shownErrors` / `showsAsInvalid` — asked by the five
field controllers, the six projections, and each renderer through a single accessor of its own.
Thirty-three call sites had been deciding it separately, which is how the projection and the wrapper
beside it came to disagree in the first place.

The errors are not forgotten. The field keeps them, the form keeps ignoring them, and both come back
the moment the field is in play again: the verdict was never wrong, it was being shown to someone who
could not act on it.

The Angular devtools panel deliberately keeps reading the field's own errors: a debugging view shows
the model, not what the user is being asked.

Closes finding T (`docs/contract-gaps.md`).
