---
"@modyra/core": patch
---

A secret in a collection row is treated as one

`sensitive` reached a leaf and a leaf inside a group, and stopped at a collection boundary: a row's
cell was printed in the panel, missing from `sensitivePaths()`, and kept out of the draft only when
some unrelated field happened to share its name. A row is where a form most often holds a secret — a
card per row with its CVV, a beneficiary per row with their tax id — and it is declared once, by the
template.

Two repairs: a row's cells declare the flag when the row is created, and the draft asks for the
declarations on every read and write rather than copying them once (a row created later was invisible
to a set taken before it existed). Declared secrets now match by exact path or subtree, never by bare
leaf name — which also stops an ordinary column vanishing from a restored draft because a field
elsewhere was a secret.
