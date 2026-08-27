---
"@modyra/plain": minor
"@modyra/angular": minor
---

A panel closes when focus leaves the field, in every kind that declares it should

`capabilities.dismissOnFocusOutside` is declared `true` by all six kinds that have a popup, and was
honoured by one renderer in six and by no Angular renderer at all. A published rule that three
implementations agreed to ignore, because nothing asked them for it.

A panel left open behind a field somebody has tabbed away from covers the next question and answers
to a keyboard that has gone elsewhere.

Both renderers now honour it in one place rather than six: a shared helper in `@modyra/plain`, and
`MdyOverlayControl` in `@modyra/angular` — whose own comment had always described a subclass's blur
handler consulting the pointer precedence, with no such handler in any of them.

It listens for focus **arriving** rather than departing. A departure does not answer the question:
a panel that repaints — a calendar swapping its day grid for its months — destroys the element
holding focus, which fires a departure naming nowhere, indistinguishable from somebody leaving the
field. A pointer still outranks it, so a drag begun inside the panel does not close it on the way
past.
