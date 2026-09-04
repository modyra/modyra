---
"@modyra/vue": patch
"@modyra/styles": patch
---

A press on the select's caret reaches the control that opens — and the caret stays where the contract
puts it.

An opener is a box rather than a point: the platform's own chooser, which every other renderer uses
for this kind, opens on a press anywhere inside it. `@modyra/vue` is the only adapter drawing a
custom trigger, and the caret drawn over the end of its field was a hole in that box — a press at its
centre landed on the wrapper, reached no handler, and did nothing.

The first attempt at this moved the caret inside the button, and the browser tier rejected it in one
run: `arrow` declares `inputWrapper` as its parent, so that was contradicting a rule the suite
guards. The claim was right and the remedy was not.

So the repair is geometric. `@modyra/styles` states two things for every renderer rather than one
theme: **a decoration never intercepts a pointer**, wherever it is drawn — the foundation already
claimed this in prose while the rule lived in a single theme and assumed a native `<select>` filling
the line — and **the trigger stretches to fill its wrapper**, so the box under the caret belongs to
what opens. Neither changes the element a theme draws its border on.
