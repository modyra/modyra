---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Let a keyboard reach the action inside the colours panel

The colours panel holds a button for entering a custom tint. `Tab` closed the panel before reaching
it, and the arrows stay inside the swatch grid by design — so that control was operable with a
pointer and with nothing else, in every renderer, for as long as the field has existed.

The contract already knew the rule: a panel with actions of its own keeps `Tab` and walks its own
ring, and one you only choose from lets the key close it. What it did not know was that colours
belonged to the first family — the predicate asked whether a kind declares an `actions` *bar*, while
the sentence beside it asked whether the popup holds controls of its own.

The predicate now reads what it means, from declarations the catalogue already carries: a part inside
the popup, drawn as a button, that is not one of the choices and is **not repeated**. Enumerated over
all seventeen kinds, exactly one moves — colours. Its ring is the swatch grid as a single stop, then
the custom entry, wrapping; `Escape` is still the way out.

**What changes for someone using a keyboard**: in a colours field, `Tab` now walks to the custom-tint
button instead of dismissing the palette. Nothing changes for the kinds that let `Tab` out — select,
multiselect and the two calendars still close and hand focus onward.

The multiselect's per-row stepper is the same defect in the other shape, and is decided rather than
left open: one action per row cannot be a tab stop, so it gains a declared key instead. Until that
ships, that control is still pointer-only. ADR 0198.
