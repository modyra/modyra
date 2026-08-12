---
"@modyra/core": minor
---

A surface you can read from the entry point

Four `export *` published seventy-four symbols nobody could enumerate without opening four files,
forty-seven of them from the least curated module in the package. Neither the type-surface audit nor
the coverage audit was measuring a surface anyone had chosen — they were measuring whatever those
files happened to contain.

They are named exports now, and the proof that the enumeration is complete is that the type surface
did not move: 581 shapes before and after.

`MDY_FIELD_KINDS` and `MdyFieldKind` are on the entry, so a consumer can ask what a field can be
without going through the document parser that used to own the list.

`MDY_DYNAMIC_DIAGNOSTICS` makes the code table data. Codes were derived by substring-matching English
error messages, so rewording a sentence renamed a code somebody was matching on and nothing objected.
The coupling is not removed — the phrases still have to appear in the messages — but it is written
down and checked: every named code is driven by a document that must produce it, and rewording a
message without updating the table fails two tests by name.

One thing the tests now state that the types did not: `ok` reports whether the *envelope* was
understood, and the counts report what happened to the *fields*. A document whose every field was
refused is `ok: true` with `fields: []`, so a consumer reading only `ok` mounts nothing and believes
it succeeded.
