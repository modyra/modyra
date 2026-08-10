---
"@modyra/core": patch
"@modyra/widgets": patch
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/plain": patch
---

Two features finished: a condition can cover a whole section, and every option widget shows what it
holds.

**`when` on a section.** `group(children, { when })` asks the question once for a branch instead of
repeating one predicate on every leaf under it — which is the work `when` existed to remove. A
field's own condition and every section above it are all consulted: the field is in play only while
each of them says so, and a section inside a section obeys both. It works the same inside a
`record()` or `array()` row, where what the predicate reads is its own row.

The predicate now receives the form value in **the nested shape the schema declares**, so
`form.address.country` reaches a nested sibling. It used to be handed the engine's flat map, which
happened to work for top-level keys and for nothing else.

**A value the options do not contain is shown by every option widget.** The rule left the renderers
and moved into the controllers: `createSelectController` and `createMultiselectFieldController`
compute the list a renderer paints — the declared options plus every held value they do not name —
and expose it as `state.options`. The multiselect now renders a chip for such a value, which is also
the only way to take it off; before, the value was held and submitted with nothing on screen.

**Removed**: `unknownOptionLabel` from the Angular select input list and the Lit select's properties,
and the `label` parameter of `optionsWithUnrecognizedValue`. Naming an out-of-list value is done by
supplying an option for it — the same code in every renderer and in a data-only document, which a
callback could not be.

See ADR 0029, amendment "the rule belongs to the controller".
