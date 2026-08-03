---
"@modyra/lit": minor
---

A select you can type into, when it has no search field.

`mdy-select-field` rendered a custom combobox in both modes. Without `searchable` — which is the
**default** — that gave a keyboard user arrows, Home/End and nothing else: no way to type towards an
option, which the authoring practices call typeahead and which a list of fifty options needs.

It now renders the native chooser in that mode, which is what the framework adapter facing the same
choice already does. That brings the platform's typeahead, its keyboard model and its mobile picker,
and it adds no contract surface: the control sits in the ordinary field shell and wears no new class.

`searchable` is unchanged and still renders the custom combobox with its filter input, so a select
that had one keeps it.

**The conformance consequence, stated because it is easy to miss**: a native chooser has no
`trigger`, no `popup` and no `listbox`, so a non-searchable select does not exhibit the `select`
kind's overlay anatomy — deliberately, and identically to the framework adapter that made this
choice first. The conformance fixtures set `searchable` for exactly that reason, and now say so.
