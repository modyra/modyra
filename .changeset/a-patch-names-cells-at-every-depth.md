---
"@modyra/core": patch
---

A patch through a list inside a list keeps the cells it did not name

`patch()` names cells, and a list nested inside an **array** row was the one place that stopped being
true: every cell the body left out came back as its declared initial, replacing what the person had
entered. One body naming only `v`, the same inner list under four containers:

    outer = array    [{"v":"NEW","w":"z"},  {"v":"V2","w":"z"}]     ← w lost
    outer = record   [{"v":"NEW","w":"W1"}, {"v":"V2","w":"W2"}]
    outer = group    [{"v":"NEW","w":"W1"}, {"v":"V2","w":"W2"}]
    no outer         [{"v":"NEW","w":"W1"}, {"v":"V2","w":"W2"}]

The cause is the order things happen in. Writing an array row goes through `setAll`, which rebuilds
the subtree — so by the time the inner collection's own manager is asked to merge, it has no rows
left to merge against and every unnamed cell is a new row's initial. The value handed to `setAll` has
to be complete already, so the row merge now walks into nested collections instead of replacing them:
a list merges its rows by index, a record by key, and a row past the end is new and taken as it came.

`W1` and `W2` were the person's data and `"z"` was a value the form had never held.
