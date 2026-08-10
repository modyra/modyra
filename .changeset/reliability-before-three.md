---
"@modyra/core": patch
"@modyra/widgets": patch
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/plain": patch
---

Four defects found by attacking what the previous release added, before it ships.

**`when` was ignored inside `record()` and `array()` rows.** The condition applied to a field
declared at the top of a schema and to nothing inside a collection — so a required cell in a table
made the form permanently invalid, which is the exact defect `when` exists to end. Rows now honour
it, and the predicate's second argument is **what encloses the field**: the row when the field is
inside a collection, the form otherwise. A rule written once for the item of a collection cannot name
a key or an index, so what it reads is its own row.

**A select with object option values could swap one entity for another.** The match compared values
through `String()`, and every plain object renders as `[object Object]` — so an option list holding
entity A "recognised" entity B and wrote A into the model. Matching is now loose only between
primitives, which is why it exists (`"1"` from JSON against `1`), and by identity for everything
else. This one predates the previous release.

**A slider's track and its painted fill disagreed.** The attributes took the field's rules while the
fill was measured from a hardcoded 0, so a slider bounded at 10 drew its handle in the wrong place.
Both now read one range. Sliders in all three renderers also derive their track from the field's
bounds when the control does not state one — Angular's `[min]`/`[max]` accept `null` for "not
stated", which is what lets the field answer instead.

**A bound that is not a finite number is no longer offered to a control.** `min(NaN)` produced
`min="NaN"` on the input: ignored by the browser, misleading in a diff. The rule still runs.

Measured while here: 300 controls mounted before their rows are declared cost ~13ms to bind; the
number is in the benchmark harness so a change that makes it quadratic is visible.
