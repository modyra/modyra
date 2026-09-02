---
"@modyra/widgets": minor
---

Two shared classes the themes already selected on are declared

`mdy-floating-label` and `mdy-dynamic-form` join `MDY_SHARED_UI_CLASSES` — the table of classes that
belong to no kind's anatomy and that a theme may select on. Six themes already style the first and
two the second, so the promise was being kept without being made.

They are published where that table is: `@modyra/widgets/vocabulary`, which describes the contract
for themes and checkers rather than offering it to renderers. See ADR 0194 for the three doors and
which one a class belongs in.
