---
"@modyra/widgets": minor
---

Which shape a document asks for

ADR 0176 gave the select two anatomies and published no way to ask which one a given field selects,
so a renderer drawing one shape and ignoring the property was violating nothing stated, and a checker
had to hard-code the rule or guess.

`variantOf(kind, spec)` answers from the document's own words: a multiselect's `mode`, a select's
`searchable`. And `MDY_POPUP_OPENERS.select` now says the opener relation belongs to the custom
shape — a `<select>` carrying `aria-expanded` claims to be a combobox, which is a lie about what it
is.

Between them a real divergence becomes visible instead of arguable: one renderer draws the combobox
for every select where two hand a non-filtering one to the platform.
