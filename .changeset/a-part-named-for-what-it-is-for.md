---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
---

A part named for what it is for: `select.listbox` is `select.options`

ADR 0132: a part's name says what the element is **for**; its role says what it **is**. `listbox` stays
everywhere it is a role and stops being a part name. A part named after a role cannot survive the
semantics changing — multiselect already proved that, when its chips stopped being a listbox and left
a part called `listbox` describing something it was not.

Select's option list is `options` now, as multiselect's already is, and one name serves both kinds. Its
role is unchanged: the element is still a `listbox`, declared through `roles` and `elements` rather
than through the name.

**The migration is one line, and narrower than it looks.**

```
class          mdy-select__list        unchanged
id             <widget>__listbox   →   <widget>__options
aria-controls                          follows the id
role                                   unchanged
```

No CSS class moved, so a consumer's stylesheet is untouched. The id moved, and only plain published it
— lit and Angular never emitted one, which is its own finding. If you named `<widget>__listbox` in
your own `aria-*` or in a selector on that id, it is `<widget>__options`.

`MdySelectA11yProjection.listbox` is `MdySelectA11yProjection.options`.

**Rejected**, so it need not be re-derived: renaming multiselect's `options` to `listbox` for symmetry
is the same mistake in the other direction; and an accessor — `optionListPartOf(kind)` — loses on
smallest public surface, because it adds a function to learn and leaves both names for anyone who does
not know it exists.
