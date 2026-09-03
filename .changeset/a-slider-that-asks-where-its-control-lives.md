---
"@modyra/vue": minor
---

`slider`, and the recursion the last two components proved

A slider is a numeric field wearing a track: its control is a native range input, and what makes it a
third shape is where that control sits — inside a required `track`, beside a required `value` that
shows the number. No wrapper, no indicator.

The component names no container. It asks the contract which element holds the control, draws that,
and fills the rest of it with the same walk over declared children that the checkbox and the toggle
use — so a kind declaring two readouts beside its control would get both without an edit here.

That walk now lives beside `partProps` rather than inside one component, which is what made this
kind cheap: the third arrangement of the same pieces needed a placement, not a renderer.

Falsified by making the component stop asking where the control lives and putting it in the root: the
kit answers `PART_NOT_CONTAINED control must render inside track`, which is precisely the declaration
the component was reading.
