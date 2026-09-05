---
"@modyra/widgets": minor
"@modyra/angular": patch
---

A door and a panel carry an address that names one kind

A panel may be drawn outside its field to escape a scrolling ancestor (ADR 0131), so there is no root
to scope a query to: a page-level query is the only one there is, and it needs an address that
identifies a kind. Four did not have one — the range picker reuses the single picker's classes, so a
query for either door or grid matched both.

It has already cost two retractions in one day: a probe pressing `.mdy-datepicker__toggle` took the
*single* picker's button and then looked for the *range* picker's panel, and reported a defect in
every renderer that nobody had.

The repair is the one the panels already had — `mdy-datepicker__popup--range` has distinguished them
since it was written. Each side of the pair now carries the same kind of marker on its door and its
grid: `--single` on the date picker, `--range` on the range picker. A probe cannot separate what the
contract writes identically, so the address belongs in the contract rather than in a cleverer probe.

The markers are addresses, not paint: they carry no treatment, and the themes are unchanged.
