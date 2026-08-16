---
"@modyra/widgets": patch
---

What `optional` means on a structure node, said where a reader looks

Six kinds declare a required part inside an optional `popup` — `select.listbox`, `multiselect.listbox`,
`datepicker.calendar`, `daterange.calendar`, `timepicker.container`, `colors.presets`. Read as "always
present", that contradicts `overlayOnlyParts`, which names those same parts as ones a closed widget has
no reason to build: an adapter author trusting one builds a listbox inside a closed select, and one
trusting the other leaves a part marked required missing.

`overlayOnlyParts` already stated the resolution in its own doc — *"a closed widget is not required to
render any of them … what both must do is render them when open"*. `MdyWidgetStructureNode.optional`
now says the same from the part's side, where someone deciding what to build actually looks: **required
means required while its parent is on the page**, not for the widget's whole lifetime.

Under that reading both statements are true and a lazy overlay and an eager one are both conformant,
which is what `overlayOnlyParts` exists to say. No behaviour changes.
