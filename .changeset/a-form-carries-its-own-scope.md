---
"@modyra/widgets": major
"@modyra/plain": major
"@modyra/lit": major
"@modyra/angular": major
---

Every form carries an id scope, so two forms on one page stop sharing their ids.

Measured on two forms built from the same document, in all three renderers: every id shared, and the
second form's `aria-describedby` resolving to the **first** form's help text — read out, verbatim, to
a person who cannot see the field it belongs to. `getElementById` returns the first match, so nothing
throws and nothing looks wrong.

A form now has a scope whether or not the consumer asked for one, and every widget bound to it derives
its ids inside that scope. ADR 0146 records the decision and what it costs.

**Every id changes.** `when` becomes `f<scope>-when`, `when__label` becomes `f<scope>-when__label`.

**Migration.** Pass the scope you want and the ids are the ones you already know, with your scope in
front: `mountMdyForm(host, fields, { idPrefix: "signup" })`, `<mdy-text-field id-scope="signup">`,
`[idScope]="'signup'"`. A consumer naming an id in a stylesheet, a test or their own
`aria-describedby` should do this.

**Without one**, the scope is a function of the document — a signature of the field paths — so a
remount and a client hydrating a server render arrive at the ids they had. What that cannot separate
is two forms built from the *same* document: plain tells them apart because it can see the page it is
mounting into, and lit and Angular cannot, because they compute an id before the element exists. For
those two the twin case stays what ADR 0135 concluded it was — the consumer's to answer with a scope.

`formScopeOf` and `widgetScopeOf` are exported for a renderer built outside this repository.
