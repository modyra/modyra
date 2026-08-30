---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

`inputWrapper` means the shell's box for every kind, including the multiselect

The multiselect gave the name `inputWrapper` to its own layout box, `.mdy-multiselect`, while every
other kind means the shell's `.mdy-input-wrapper` by it. Both boxes exist and one is nested in the
other, so a check that resolved the part per kind compared the shell for three kinds against the inner
box for the fourth — and reported the 1px border a theme draws on the shell as a two-pixel height
defect. One name for two different elements is not a naming inconvenience; it is a measurement that
cannot be right.

`multiselect.parts.inputWrapper` is now `["mdy-input-wrapper"]`, as everywhere else, and the widget's
own box is its own part: `box`, classed `mdy-multiselect`, carrying no shell state — which is what the
old arrangement was working around, since handing `mdy-multiselect` the shell's states would have
minted `mdy-multiselect--disabled`, styled by no theme and emitted by no renderer.

Migration: a consumer resolving `MDY_WIDGET_CONTRACTS.multiselect.parts.inputWrapper` to select the
chips area wants `parts.box`. Nothing in the rendered DOM moves — both elements were already there.
