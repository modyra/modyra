---
"@modyra/widgets": minor
"@modyra/angular": patch
"@modyra/plain": patch
---

A chip, a handle and a numeric kind, each named once

`MDY_CHIP_CLASSES` gains `removable`. The Material theme has styled
`.mdy-chip--removable` all along and the contract never named it, so the one
directive that applied it was deciding for itself what a removable chip is. The
Angular chip directive and the multiselect template now take every chip class
from the table; between them they spelled ten.

Angular stops restating `MdyArrayHandle` and `MdyRecordHandle` member by member.
Both are derived from the engine's handles the way `MdyFieldHandle` already was,
for the reason that file already gives: the copy drifted the moment the engine
gained a member, and satisfied the local idea of the type while throwing at
runtime. `cell` stays narrowed, because the handle it returns carries this
framework's signals.

The framework-free renderer asks the value contract which kinds hold a number
instead of listing them again, and takes its daterange and timepicker part
classes from the catalogue rather than from seven string literals.
