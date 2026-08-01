---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/plain": patch
---

The DOM contract is now checked with the overlay open.

Every conformance suite inspected widgets at rest, and a resting overlay widget renders none of its
popup. **Forty-five parts across six kinds** — the listbox and its options, the calendar grid and its
cells, the clock face — had their classes, parents, order, semantics and cardinality checked nowhere
at all. `overlayOnlyParts` names them, which is what made the scope a measurement rather than a
guess; 38 of the 45 are rendered by an open widget and are now inspected.

Defects it found, all in shipped renderers:

- **Lit's calendars had no grid semantics.** Rows carried `role="row"` and weekdays
  `role="columnheader"`, but the grid had no `role="grid"` and the day cells no `role="gridcell"` —
  rows floating outside any grid, which is not a structure assistive technology can navigate. Plain
  had it right, which is how the contract was confirmed rather than assumed.
- **Four Lit overlays never named what they controlled.** The datepicker, daterange, timepicker and
  multiselect openers carried `aria-expanded` and no `aria-controls`, and the popups they open had no
  id to name. The reference is emitted only while open, so a closed overlay does not dangle.
- **Lit's select trigger dropped `role` and `aria-describedby`** from the projection it otherwise
  reads attribute by attribute — the third defect of that shape.
- **Lit's multiselect label named a `<div>`**, which `label[for]` cannot resolve. It now names the
  search button, the opener the contract declares.
- **Lit's colour palette put `role="listbox"` on the panel that positions it** rather than on the
  grid of swatches whose children are the options.
- **Plain's pickers rendered no calendar frame.** Lit and Angular both emit
  `mdy-datepicker__calendar` and two themes lay it out, so Plain's date pickers were arranged by
  rules that could not reach them.

Three contract corrections came out of it: `mdy-overlay-backdrop` and `mdy-timepicker-segment-label`
were emitted by renderers and declared nowhere, and `right` becomes a declared popup placement state
— an adapter's own comment recorded that it had to spell that class as a literal "because the catalog
declares no alignment state".

The multiselect's value area is declared before its header. That order used to fall out of the
sequence the part names happened to be written in, which is not a decision, and it put the
placeholder after the affordance that changes it — which no renderer does.
