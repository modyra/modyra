---
"@modyra/widgets": minor
"@modyra/angular": patch
---

One source for the relation between an overlay and the control that opens it

`projectOverlayOpenerA11y` returns the `aria-expanded` and `aria-controls` an opener carries. It is a
function of kind, widget id and open-ness alone, so a renderer can bind it without building the
controller that produces the rest of a kind's projection — and the kind-specific projections call it
too, so six kinds across three adapters have one answer rather than four.

`MDY_POPUP_OPENERS` now records both halves of the relation: which part opens the overlay and which
part the relation names. Those are not the same thing — ARIA points at the element carrying the role,
which is a listbox for select, a grid for the datepicker, a dialog for the timepicker, and the popup
itself for the rest. The entries were previously bare strings.

Angular's multiselect binds it: the search button carried no `aria-expanded` at all, so nothing
announced that the overlay had opened. Its projected panel gains an id for the opener to name,
through a new `panelId` input on the overlay panel — a panel rendered outside the field it belongs to
has nothing else tying it back.
