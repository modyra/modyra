---
"@modyra/widgets": major
---

The declared anatomy matches what the widgets actually are

Four defects in the catalogue, each of which had been hiding a renderer difference rather than
describing one.

**The timepicker's dial was declared outside its popup.** `container` fell through to `root`, so
`overlayOnlyParts` covered only the popup and the dialog — and the thirteen parts of the dial were
treated as resting-state anatomy. A renderer with a closed picker therefore looked like one that had
lost thirteen parts. They are inside the popup now, which is where all three renderers put them.

**Five parts carried no classes**, so no check could ever locate them. `datepicker.calendar`,
`datepicker.dialogHeader` and `daterange.calendar` now carry the classes their renderers already
emit — two of which had been filed as decoration. `daterange` gains `dialogHeader`, which it renders
and never declared.

**`number.decrement` and `number.increment` are removed.** No renderer implements them, no class
could find them, and no theme could style them. A part nothing renders and nothing can check is not a
contract.

**`nativePicker` is `affordance`, not unconstrained.** It admits a `<label>` or a `<button>` — both
are correct ways to reach the value, and the second avoids nesting a focusable control inside
another. The previous release made it unconstrained, which let anything satisfy it.

The calendar header may sit inside the calendar or directly in the popup, the same transitive rule
the grid already had.
