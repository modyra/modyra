---
"@modyra/lit": patch
---

A part carries the role the catalogue declares for it

`aria-haspopup="dialog"` on the multiselect's opener promises somewhere to go and come back from, and
the popup it named was a bare `<div>`: the promise pointed at an element with no role at all. The
catalogue declares `popup: "dialog"` for the kind, and the checkbox's control `checkbox`; both are
now read from there rather than left to whatever each element happened to write.

`partRole` sits beside `partClass`, so a part's role comes from the same place its classes do.
