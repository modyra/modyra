---
"@modyra/plain": patch
"@modyra/vue": patch
"@modyra/angular": patch
---

A year chosen from the keyboard keeps the keyboard on the months

Pressing Enter on a year in a datepicker or date range shows that year's months. The year view was
taken away under the focus, so the next key went to the page. Focus now lands on the shown month, or
on the first month the bounds allow, as it already did in the Lit renderer.

No migration.
