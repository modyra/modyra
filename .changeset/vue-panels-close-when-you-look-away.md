---
"@modyra/vue": minor
---

`@modyra/vue`'s panels close when a pointer interaction finishes somewhere else.

Every overlay kind in the catalogue declares this, and no panel here answered it: clicking the page
behind an open list did nothing to the list, and the only way out was to find the control again.

**What counts as "outside" is not `contains` on the field.** The panels are drawn in the document
body, so a pointer inside a panel is outside the field's own element — a rule written that way would
dismiss on every press a person makes *in* the panel they are using, which is worse than not
dismissing at all. The contract already answers it: it follows the widget's own `aria-controls` out
to the panel, so what a renderer declares is the field root and the reaching-out is not its problem.

The capability is read as declared rather than asked as a yes or no: it names the interaction
(`"light-dismiss"`), and `capabilityOf` refuses to reduce it to a boolean — `false` is the only
value meaning a kind does not do this. Listeners are bound only while a panel is open, so a page
does not carry a document listener for every closed widget on it.
