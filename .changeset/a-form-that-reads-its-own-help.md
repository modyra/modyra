---
"@modyra/angular": patch
---

Two forms of one document no longer share their ids

Ids are built from the field's path, a path is unique within a form, and `getElementById` returns the
first in the document. So with two forms of one document on a page, the reference in the second did
not dangle — it resolved to the **first form's** element: somebody filling in the second with a screen
reader heard the help text of a field they were not looking at. Nothing looks wrong and nothing
throws; the page is answering a different question correctly.

`<mdy-dynamic-form>` now derives a scope when none is bound, from the same primitive the
framework-free renderer uses, so a document behaves the same whichever renderer draws it. The comment
on `idScope` has always said the scope is taken at this door — it was not, and the default was empty.
Binding `[idScope]` still decides: this fills the silence rather than overruling.

The live scopes are tracked in memory rather than read from the page, which is the one place this
differs from `mountMdyForm`. There, mounting is a call and the first form has written its ids before
the second asks. Here both are computed in one change-detection pass, before either has rendered, so
a form looking in the document finds an empty page and takes the same scope as its neighbour.

Two forms of one shape is not exotic: a filter beside a form, a repeated row, two tabs side by side,
a dialog over a page.
