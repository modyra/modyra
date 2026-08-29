---
"@modyra/widgets": minor
---

A select is two shapes, and the contract says which

A select renders the platform's own `<select>` unless it filters, and the combobox when it does. The
catalogue said so in a comment and said nothing an instrument could read, so read as one anatomy it
owed every select the combobox's parts and its opener relation — and six cross-renderer findings sat
unfixable, because repairing any of them meant giving a native `<select>` attributes it must not
have.

`select` declares two variants. `custom` requires the mark that says it opens; `native` describes what
the platform makes of the parts it has — the trigger is the `<select>`, the placeholder an `<option>`.
`value` and `placeholder` keep their own presence conditions and simply do not exist in the native
shape.

`MdyWidgetVariant` gains `"native" | "custom"` beside the multiselect's modes. Two axes share one
vocabulary because a variant name is only meaningful for the kind that declares it: asking a select
about `multi` selects no anatomy rather than the wrong one.

The conformance kit learns that a `<select>` is a combobox and a `<select multiple>` a listbox, so the
native shape carries the role its trigger promises without spelling it.

ADR 0176, including what it does not settle: the opener relation belongs to the custom shape and the
relation table is not variant-aware, so nothing enforces that yet.
