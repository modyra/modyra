---
"@modyra/widgets": minor
---

A reference resolved id by id, keeping the two kinds of nothing apart

`aria-describedby` naming an element **not in the document** is a defect in every case: the reference
cannot resolve and no rendering will make it. Naming one that **is** there and holds nothing is not —
ADR 0180 reserves the error container under every field that can fail a rule, so a reference to an
empty one is a conforming form at rest.

Both read as "the description came back empty" in a failing assertion, which is why
`readReferenceTargets` separates them rather than leaving it to whoever reads the result. A sweep that
folds them together sends a reader to the container when the defect is in the reference, and the
other way round.

Measured against a real widget: at rest the reserved container is `emptyButPresent` and nothing is
dangling; once the field fails, the container fills and nothing is dangling then either.

With no document to resolve against, the collector reports that it could not look. Reporting every id
as dangling would be it turning its own missing context into a finding about the page — the direction
that confirms, which is the one worth guarding against.
