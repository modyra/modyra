---
"@modyra/widgets": major
"@modyra/lit": minor
---

A state belongs to something that can be in it

`aria-invalid` and `aria-required` describe a value. A `role="button"` has none, so an assistive
technology has nothing to attach the claim to and drops it: the state is not reported wrong, it is
absent.

Swept across all seventeen kinds in both renderers, one kind carried them where they could not be —
the multiselect. `MDY_POPUP_OPENERS` declares `role: "combobox"` for `select`, `datepicker` and
`timepicker`, and declared nothing for `multiselect`, so its opener was a bare `<button>` wearing
`aria-expanded`, `aria-invalid` and `aria-required`. Every other kind was clean in both renderers,
which is what places the cause in the contract rather than in a renderer's habits.

The multiselect's opener is now a combobox: it holds the field's value, the label points at it, and
all three states are legitimate on it. `searchButton` is an `input` in the semantics table rather than
a button — the multiselect has no typeable control, so this is the control. The opener projection's
**role** now reaches the part contract as well as its attributes; spreading only the attributes is how
a correct declaration produced markup that was not.

`@modyra/lit` also put the same pair on the `role="group"` box around the chips. A group describes what
it holds, not a value; it keeps its label and its description and nothing else.

Anything selecting on `[role="button"].mdy-multiselect__search-btn` stops matching. The opener stays in
the class list a theme sizes hit targets with — `trailingAffordances` keyed on the element being a
button, and now also takes an opener drawn inside the field's header.
