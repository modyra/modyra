---
"@modyra/widgets": patch
"@modyra/plain": patch
---

An opener names the popup it opens

Select and multiselect have always declared the full relation: the control that opens the overlay
says it has one, whether it is showing, and *which* one. The pickers and the colour field declared
the first two and never the third — the trigger said `aria-haspopup="grid"` and `aria-expanded`, and
named nothing, so nothing tied opener to popup for assistive technology.

`aria-controls` is now declared in the datepicker and timepicker a11y projections, so every adapter
inherits it, and Plain's daterange and colours wire their own toggles to their popups' ids.

`MDY_POPUP_OPENERS` also changed to say where the relation actually lives. The pickers follow the
combobox pattern — the typeable control carries `role="combobox"`, `aria-expanded` and now
`aria-controls`, and the calendar button beside it is a second affordance for the same popup — so
the opener is the control, not the button. Colours and daterange are the exceptions and really are
opened by their toggles.
