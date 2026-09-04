---
"@modyra/vue": patch
"@modyra/styles": patch
---

A press on the select's caret opens the list.

The contract names a *part* as this kind's opener, and an opener is a box rather than a point: the
platform's own chooser — which every other renderer here uses — opens on a press anywhere inside it,
and the caret is decoration beside it. `@modyra/vue` is the only adapter that draws a custom trigger,
so it is the only one that could put a hole in that box, and it did: the caret was a sibling of the
button, a press at its centre landed on the wrapper, reached no handler, and did nothing.

The caret is inside the trigger now, so any press on the visible control is a press on the element
that opens. `@modyra/styles` states the belt for every renderer rather than one theme: a decoration
never intercepts a pointer, wherever a renderer draws it. The foundation already claimed this in
prose — *"it is `pointer-events: none` and the trigger behind it is already the target"* — while the
rule lived in a single theme and assumed a native `<select>` filling the box.

The check presses the caret's centre, which is the point that did nothing; a press on the trigger's
text passed the whole time this was broken.
