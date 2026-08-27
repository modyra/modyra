---
"@modyra/widgets": patch
---

`contract:diff` sees the class names that belong to no kind

The snapshot reaches class names through a kind's anatomy, so a name outside every kind was invisible
to it: the shared button, the overlay machinery, a layout's own boxes, the form shell. Fifteen names
across three published vocabularies.

Seven of them are selected on by the themes shipped here, so the dependency was real while a rename
would have been classified as an internal change — and every stylesheet using one would have broken
on a release the gate called a patch. `contract:diff` was not silent about them; it was silent
*because* of them, which is the harder kind to notice.

They are recorded beside the scale, for the same reason and in the same shape: names, not values,
because what a class *is* belongs to a theme and what a consumer cannot survive is a name that stops
answering.

Named one vocabulary at a time rather than discovered by shape. A vocabulary is sometimes an array
and sometimes a dictionary, and a flat dictionary is the degenerate case of a table with one column —
a rule reading the shape cannot tell them apart and would quietly stop covering whichever it did not
anticipate.
