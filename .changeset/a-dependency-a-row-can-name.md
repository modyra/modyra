---
"@modyra/core": patch
---

A row's template can name its own sibling in `asyncDependsOn`

A row is a template: declared once, instantiated per key. A cell naming its sibling can only write
the name that sibling has *inside* the row, and that name was resolved against the form root, where
it does not exist — so the only spelling that re-ran the check was `rows.a.code`, which a template
cannot write, because it precedes every row and is shared by all of them. There was no correct way
to declare a cross-field server check inside a collection.

A `dependsOn` name now falls back to the row that encloses the clause. The absolute path is tried
first, so nothing that resolves today resolves differently.

A finding reported under a document's tree also names the field by the key its parent gave it, rather
than by the placeholder the leaf reader uses.
