---
"@modyra/core": patch
---

A bulk write into a keyed collection costs what its rows cost: 2,000 rows in one `setAll` went from
about 1,600ms to about 70ms, and the per-row cost stopped growing with the row count. Three things
were quadratic and each was paid once per row: the gate over the collection was re-read after every
row, walking every claim and every field the form holds; the published key list was copied for each
key; and `fieldNames` was a list copied for each field created. The gate is re-read once per bulk
write, the key list is published once from the set that already answers `has()`, and `fieldNames` is
derived from the fields the engine holds behind a version counter, so a reader inside a batch pays
for the list once instead of once per row. Nothing about what the collection holds changed.
