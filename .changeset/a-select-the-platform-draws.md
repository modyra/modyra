---
"@modyra/plain": major
"@modyra/widgets": minor
---

A select that does not filter is drawn by the platform

`@modyra/plain` rendered a custom combobox for every select. ADR 0176 declares the kind as two
shapes and says which is which: a select that filters is the combobox this library builds, and
anything else is the platform's own chooser — which already has the typeahead a list of fifty needs,
the platform keyboard model, and the picker a phone puts up. The other two renderers already drew
it that way.

**Breaking for a document that declares a select without `searchable`.** It now renders a `<select>`
with `<option>` children instead of a button and a portalled listbox. A stylesheet or a script
reaching for `.mdy-select__trigger` will find a `<select>` rather than a `<button>`, and there is no
`.mdy-select__dropdown` in the document for that field — the popup is the platform's. Add
`searchable: true` to keep the combobox; it is unchanged.

The projection follows the shape. `projectSelectA11y` hardcoded `role="combobox"` and the opener
relation — `aria-expanded`, `aria-controls`, `aria-activedescendant` — on every trigger. Those
describe a list the projection does not draw when the platform owns the popup, and on an element
whose role does not admit them they are dropped without a word. Both shapes still carry the field's
own verdict: wrong, required, described by, out of play.

`MdySelectControllerOptions.searchable`, `MdySelectFieldControllerOptions.searchable` and
`MdySelectA11yOptions.variant` are new and optional. A caller that says nothing keeps the shape it
was already drawing, so nothing loses the combobox relation while it is still drawing a combobox.
