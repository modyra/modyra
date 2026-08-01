---
"@modyra/widgets": major
---

A read-only control can still be reached

`disabled` and `readonly` were two independent booleans, and fourteen call sites across the
controllers each wrote their own combination of them. They did not agree. Most wrote
`disabled || readonly`, which is correct for changing a value and wrong for everything else.

One of them was actively harmful: the multiselect applied a **native `disabled`** to its search box
for read-only fields, taking the control out of the tab order. A read-only field's whole purpose is
that you can still reach it, select its text and copy it — and the search box does not even change
the value, it filters what is shown, which a user who may read the field must be able to do.

There are only two questions, and they are now named:

- `blocksValueChange(interactivity)` — true for `readonly` and `disabled`. Input, toggling,
  stepping, clearing, confirming a picker: anything that writes.
- `blocksFocus(interactivity)` — true for `disabled` alone. The native `disabled` attribute,
  `tabindex`, and anything deciding whether the control can be reached.

Widget state carries `interactivity` alongside the derived `disabled`/`readonly` booleans, so a
renderer reading either still works. `setReadonly()` remains an imperative escape hatch for a
renderer with no form behind it, and can now only ever *reduce* what is permitted — it cannot
re-enable a field the form disabled.
