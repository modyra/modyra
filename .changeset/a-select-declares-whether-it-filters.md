---
"@modyra/core": minor
---

A select declares whether it filters.

`searchable?: boolean` joins the option-based field config, defaulting to `false`. It selects one of
two interaction models, and they are different controls to anyone not using a pointer:

- **`false` is a listbox** — no filter box, focus stays on the trigger, typing accumulates into a
  typeahead that jumps to the first matching option.
- **`true` is a combobox** — focus moves into the search input on open, typing filters.

Both drive the list with `aria-activedescendant` rather than moving focus into it.

It is contract data rather than a renderer input because the alternative is what exists today: it was
a component input in two adapters, absent from the third and from the document format, so one widget
had three behaviours and one of them matched a single character of any typeahead. A renderer cannot
honour a distinction it has no way to read.

Both SDKs carry it, for the reason `mode` did: a document that loses it describes a different
control.

[ADR 0018](https://github.com/modyra/modyra/blob/main/docs/architecture/0018-a-select-declares-whether-it-filters.md)
records the two models and what each renderer owes them.

**Classification.** `contract:diff` reports `patch`: it snapshots the widget catalogue, and this is a
field on the *form* contract, which it cannot see at all. Shipped as `minor` for an additive optional
field — the same blind spot as finding **K**, in a part of the surface that finding had not yet
reached.
