---
"@modyra/plain": patch
---

The field's name stops landing on the list of chosen values.

`insertControl` puts the field's accessible name on "the element a person operates", and asked for
`input, select, textarea, [role], button` at once it took whichever came first in the DOM. For a
multiselect that is the **chip strip** — a `role="list"`, structure rather than control — so the name
was announced on the list while the combobox beside it carried the same word. A reader heard "Scelte"
twice, for two different things, in the only renderer of three that did it.

A real control is asked for first, and a bare `[role]` only if there is none. All three renderers now
present the same tree: an unnamed list of chips beside a named combobox.
