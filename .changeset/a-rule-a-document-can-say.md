---
"@modyra/core": minor
---

A document can declare a whole number

`integer` is a rule a form could be given by hand and not by document. The same form written the
two ways produced two different controls: the hand-written one attached `step: 1`, so a number box
offered whole numbers to the keyboard, and the declared one had no way to say it.

`validators.integer` is now part of the document language, alongside `required` and `email`, with
`messages.integer` for the author's own wording. The message catalogue already carried the sentence
in every locale it ships.

The rule is declared, never the fact behind it. `step` is what `integer` *does* to a native
control, and a document says what it wants rather than what that costs — the same reason `email` is
declarable and the `inputMode` it attaches is not.
