---
"@modyra/widgets": major
---

The token that means any file takes any file, and a file field holds a list

Two defects in one function, and the second is why the first was silent.

**`accept="*/*"` — and a bare `*` — rejected everything.** They took the wildcard branch, which asks
whether a file's type begins with `*/`, and nothing does. Measured in a page: a file field with that
token takes a PNG, the model stays `[]`, and the field reads "No file selected". The most permissive
value a form can declare was the only one that accepted nothing. `image/*`, `.png`, an exact type and
no accept at all were all correct.

**`fileSelectionTransition` returned a bare file when `multiple` was false.** `MDY_VALUE_CONTRACTS.file`
declares `file[]` and is not nullable, so that shape is one the engine's own `matchesValueShape`
refuses — a single-file field was invalid for *every* file a person could choose, in any renderer that
did not wrap the value on its way past. `@modyra/plain` wrapped it and never saw it; `@modyra/lit` did
not and showed "This field holds file[]" for every choice.

The transition now always answers with a list. `MdyFileSelectionTransition.value` narrows from
`TFile | readonly TFile[] | null | undefined` to `readonly TFile[] | null | undefined`: a consumer
reading it as a single file must read `value[0]`. What `multiple: false` narrows is how many
candidates are accepted, which `accepted` already carried — not what the field holds.
