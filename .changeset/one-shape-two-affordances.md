---
"@modyra/vue": minor
---

`checkbox` and `toggle`, drawn by one component that names neither

The catalogue declares them as one shape wearing two affordances: both put a native control and its
false-carrying companion inside a wrapper, and both put the painted part inside the label. What
differs is only how deep that part goes — a checkbox declares one node, a toggle declares a track
with a thumb inside it.

Neither kind is named in the drawing. The label's children are built by walking the parts the
structure declares under it, so a third kind of the same shape would draw correctly the day it is
declared rather than the day somebody edits this. The controller's variant is read from the control's
declared role — `checkbox` or `switch` — rather than mapped from the kind's name by hand, since the
catalogue already holds that fact.

The companion carrying `false` is found rather than invented, which is the immediate dividend of
declaring it: it has a class and a semantic that discriminates, so the projection applies to it like
any other part.

Two defects the bench caught on the way, both the same shape as the one before: the control's classes
come from the catalogue rather than the projection — a text field's control declares none, so reading
only the projection was right there and wrong for every kind that paints one — and the conformance
config resolved parts through selectors written for the text field, which reported a checkbox's
wrapper as missing while it sat on the page. It now resolves through the same lookup the kit uses on
itself.

Falsified by flattening the derived subtree: the toggle loses its thumb and the checkbox stays green,
which is exactly the difference the recursion exists for.
