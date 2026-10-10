---
"@modyra/vue": patch
---

Every Vue panel is positioned against the field's input wrapper, not against the button that opens it

`overlayAnchoringFor` is the contract's statement about edge alignment and matched width, and
those apply to the field. Measured from the small button at the field's end, a select or
multiselect list came out 160px wide where it should match the field, and a right-aligned colours
panel sat hundreds of pixels from the field's edge. Applies to select, multiselect, datepicker,
daterange, timepicker and colors. No migration. Panels now line up with the field, as in the other
renderers.
