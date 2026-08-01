---
"@modyra/widgets": minor
---

Milestone B: the keyboard is declared per kind, and `widgetKeyIntent` stops answering the same way
for all seventeen.

`MDY_WIDGET_KEYBOARD` says which keys each kind claims and what they mean, derived from what the kind
*is*: a widget with options navigates them, one with a range steps it, one with two states toggles,
one with an overlay opens and closes it. `widgetKeyIntent` now reads that instead of a chain of `if`s
that asked about the key and, for one kind, the kind.

**Breaking, and the reason it is worth breaking.** The old answers were wrong for most of the
catalogue:

- a **slider** was told ArrowUp means "move to the previous option" — it has no options, and its
  arrows must change its value. It now increments and decrements, as `number` already did.
- a **text field, email, password, textarea and file** claimed ArrowDown, ArrowUp, Home, End and
  Enter. They have no list and no overlay; the native control owns those keys, and the widget layer
  was answering over the top of it. They now claim nothing.
- a **closed select** answered ArrowDown with "move to the next option" while showing no options. It
  now opens, which is how a keyboard reaches the list at all.

`Home` and `End` on a range are deliberately absent rather than approximated: they mean "go to the
minimum" and "to the maximum", and the intent vocabulary has no word for that. A gap on the record
is better than a binding that says something untrue.

No adapter consumed this function — each renderer writes its own key handling — so nothing in the
repository changed behaviour. That is also the honest limit: this makes the contract's answer right,
and does not yet make any renderer answer to it. Proving keyboard behaviour against the declaration
is task 17.
