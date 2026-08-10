---
"@modyra/core": minor
"@modyra/angular": patch
---

A control bound with `[field]` reads the form that handle came from.

`[field]` names a path, and the state behind that path was resolved against whichever `<mdy-form>`
enclosed the control. Two forms on one page — a dialog over a list is the ordinary case — share
every path they have in common, so a handle from one form displayed inside the other showed the
wrong value and wrote what the user typed into the wrong model, with nothing said about it.

A handle now carries the form that built it (`handleFormOf`, beside the existing
`getFieldHandleOwner`), and a control bound to one reads that form. A `name` binding is unchanged:
it has no handle, so the enclosing form is the only thing that could answer.

The framework-free and Lit renderers were never affected — they are handed a handle and hold no
ambient form to confuse it with.
