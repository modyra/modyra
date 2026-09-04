---
"@modyra/vue": minor
---

`@modyra/vue` draws the time field — the first panel in this package that keeps Tab.

Every other overlay here lets Tab through: it closes and the browser moves on, because there is
nothing inside worth staying for. This one has its own controls, so `popupHoldsAnAction` answers
`true`, and Tab is swallowed and turned into a walk inside the panel. Letting it out would leave
somebody half-way through setting a time, on the page behind an open dialog, with the confirm button
reachable by pointer alone.

The ring is declared rather than listed in the component. `timepickerTabOrder` says which parts are
stops and in what order, and it takes the **format**: a twelve-hour field has an AM/PM stop that a
twenty-four-hour one does not, so asking without it returns the same list either way and produces a
walk that silently skips a control. `timepickerPartSelector` turns each name into an element,
composing the wrapper's class with the control's — by the control's class alone the hour and minute
boxes are the same selector, and a step naming the minute lands on the hour while appearing to do
nothing.

The popup and the dialog are one element, as they are in the other renderers: drawn as two, the
panel a person is inside and the panel the contract calls a dialog are different elements, and the
one announced is the empty one.
