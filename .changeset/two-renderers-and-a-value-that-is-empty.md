---
"@modyra/widgets": minor
---

Two renderers can be compared, and an empty value is no longer drawn as a blank

`compareReadings(left, right, show?)` puts two renderers' readings of the same questions into one
run and returns what they disagree about, as `MdyDivergence`. Both are new on `@modyra/widgets/testing`.

A divergence is one of three kinds, and folding them together is what the shape exists to prevent:
`values` — both looked and answered differently; `one-unread` — one could not look, which is usually
a defect in the probe rather than in either renderer; `both-unread` — neither looked, which is not
agreement about anything.

The limit is part of the contract: the comparison finds disagreement and cannot find agreement that
is wrong. A property both renderers get wrong in the same way passes, and a test asserts that so it
stays a property of the suite rather than a sentence in a comment.

`MDY_EMPTY` is also new, and closes a hole in `readingText`. A value that was read and renders as
nothing — an `id=""`, a blank text node — was drawn as an empty cell, indistinguishable on a page
from a reading that never happened. The two states now have a word each, and neither is spelled
with silence. `show` still decides what nothing looks like: a formatter that returns text for the
empty string is not overruled into `(empty)`.
