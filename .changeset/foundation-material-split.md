---
"@modyra/styles": minor
---

Material stops being everyone's base

Material 3's floating label — the pattern that made the default stylesheet a Material stylesheet —
moves into `material-filled-field.css`, and `modyra-foundation.css` becomes the structural layer the
themes build on. Modern, iOS and Ionic import the foundation instead of the default theme, so none
of them inherits a field it then has to undo; Material imports the same foundation and its own
field, as a sibling.

`@modyra/styles/default.css` keeps exactly the look it has always had — it now resolves to
foundation plus Material's field — and `@modyra/styles/foundation.css` is published for anyone
building a theme of their own. Verified in the browser: the five packaged themes render the same
geometry, to the pixel, as before the split.

The architecture audit gains the rule that replaces the debt it just retired: a theme may not
import another theme. The demo build also ships every CSS file the package produces instead of a
hand-kept list — the list had gone stale the moment the package grew a file, and a theme whose
foundation 404s still renders, just unstyled.
