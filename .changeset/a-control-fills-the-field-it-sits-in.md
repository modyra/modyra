---
"@modyra/styles": minor
---

A control fills the field it sits in, and iOS states single choice the way the platform does.

`.mdy-select` and `.mdy-radio-group` were sized by their own content, so in every theme the field's
fill extended past the control and the trailing affordance sat beside the value instead of on the
field's edge. Both now occupy the field, which is what the affordance column has always assumed.

Under the iOS theme, a vertical radio group is now an inset grouped list — one surface, 44pt rows,
hairline separators inset to the text, and an accent checkmark on the selected row's trailing edge.
The circle part remains in the tree and carries the checkmark; a horizontal group keeps its circles.
The checkbox's row text takes the primary label colour rather than the field-caption colour, and
field text is regular weight throughout, matching the value of a control that is not an `input`.

Migration: a host that styled `.mdy-radio-circle` under the iOS theme expecting a circle now styles
the checkmark. A host that relied on `.mdy-select` or `.mdy-radio-group` being content-width should
constrain the field instead.
