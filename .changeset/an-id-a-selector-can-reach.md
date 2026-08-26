---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A nested field's id can be reached by a selector

A document that holds a collection names a nested field `rows.0.name`, and every renderer built that
field's id from its path. The separator is a class selector to a browser, so
`querySelector("#form-rows.0.name")` does not miss — it **throws**, because a class may not begin with
a digit. A consumer selecting a nested field by the id this contract published got a stack trace, and
the only input required was putting a form inside a form.

ADR 0141 already decided this for caller data. The library was the other producer of an unreachable
id, and the same rule now covers the path: `rows.0.name` becomes `rows_2E0_2Ename`, by the same total
escape, through the same function — exported as `idSafeKey` so the three renderers spell it one way
rather than three.

**Migration.** Every nested field's id changes, so a stylesheet, test or `aria-describedby` naming
`form-rows.0.name` names nothing after this. Those are exactly the ids that could not be selected
before. A flat document is untouched — `name` escapes to `name` — so the common id stays readable.
