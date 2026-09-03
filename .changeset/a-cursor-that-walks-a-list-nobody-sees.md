---
"@modyra/lit": patch
---

Tell the controller about the query, so the cursor stays inside the narrowed list

The searchable multiselect kept its query to itself. The panel drew the narrowed list, and the
controller — never told a search had happened — moved its cursor through the whole one. With the
query leaving only the last option, `ArrowDown` put the cursor on the first, and
`aria-activedescendant` named an option the panel was not drawing: a reader was told about "Italy"
while the panel showed Germany, and taking the named option would have taken the wrong one.

The query now reaches the controller, the panel reads `filteredOptions` from it rather than deriving
a second narrowing, and `filterFn` reaches it the same way the list does. A held value the filter
refuses is offered rather than hidden, which is the same rule the Angular renderer now follows.
ADR 0196.

The defect hid behind a coincidence worth naming: a query that leaves the *first* option standing
puts the cursor where an untold controller would have put it anyway, so the two agree. Only a query
that leaves a later option separates them, and the check now runs both.
