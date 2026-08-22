---
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A reference that resolves in every renderer

Three renderers answered one contract three ways about which elements carry an id, and the halves that
were **referenced by something** were broken in two of them.

- **Angular never gave a label an id**, for any kind. Every `aria-labelledby="<widget>__label"` the
  widget projections emit — the calendar's month and year views, the range's grids — pointed at
  nothing. `mdy-control-label` now carries the canonical id, derived from the field it labels, and
  callers whose label points at something other than the field's own control say which widget it
  belongs to.
- **plain's select had the same hole**: its controller's view has no label part to apply, so the
  label went out with no id while every other kind's carried one.
- **lit and Angular gave the multiselect's option grid no id**, so the trigger's `aria-controls`
  resolved to nothing while the control claimed to control something. Both take the id the projection
  gives that part — deliberately not the one the opener names, which is the popup's and is already on
  the panel: two elements claiming one id makes every reference to it non-deterministic.

What remains is disagreement without a broken reference: plain gives datepicker day cells and
timepicker segment inputs ids that nothing points at, in any renderer. Whether those should be added
to the other two or dropped from plain is a decision about what a part owes a consumer, not a repair.
