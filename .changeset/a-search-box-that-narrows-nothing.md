---
"@modyra/plain": patch
---

Narrow the multiselect's option list when a query narrows it

The plain multiselect drew `state().options` — every option the field was given — while the box a
person typed into dispatched the query and the controller narrowed `filteredOptions` out of sight.
Typing changed nothing anyone could see: three options offered before the query, three after a query
that matched one of them.

The controller has said which of the two a host renders all along: `filteredOptions` is documented as
"what a host renders once a search intent has narrowed the list". The renderer now reads it.

The other renderers already narrowed. Angular and Lit re-derive the same answer for themselves —
each calls `filterOptionsByQuery` on its own copy of the list — and React reads the controller's
accessor. Only the plain renderer read neither, which is why the defect had one renderer and not
three.
