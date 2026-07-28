---
"@modyra/angular": minor
---

The dynamic form arranges itself

`<mdy-dynamic-form>` takes contract v2's `layout`: sections and column rows, nestable, with the
classes and the column count coming from `@modyra/widgets` — the same vocabulary the framework-free
renderer emits, so one declaration produces one grid whichever adapter drew it. Fields the layout
does not name still render, after the arranged ones.

Every field goes through a single template whether or not a layout is declared, so the two paths
cannot drift apart, and the templates are declared inside `<mdy-form>` — outside it the controls
lose the form's injector, which is exactly what the suite caught.
