---
"@modyra/widgets": major
"@modyra/angular": minor
---

Four Angular renderers stop deciding what their controller already decides

Checkbox, toggle, radio and segmented drew their own conclusions from the field
while the controllers for their kinds sat unused. They now send their intents
through `createBooleanFieldController` and `createOptionFieldController`, which
own what an interactivity state blocks, when a value becomes dirty, and what the
projection then says.

`MdyOptionFieldController` gains `setOptions`. The list was fixed at
construction, which suits a renderer reading a document and not one whose
options are an input that can change; rebuilding the controller instead would
forget which option the keyboard was on, so a list reordering under an open
group would drop the roving focus.

**Nine renderers were telling the projection they draw a text field.**
`widgetKind` was typed `string` and defaulted to `"text"`, and colors,
daterange, file, multiselect, radio, segmented, select, slider and timepicker
never said otherwise. The kind decides which native constraints a control can
carry, so a slider offered `maxlength` and no range. Each renderer now names its
kind and the field is typed `MdyWidgetKind`, which makes a wrong one unspellable.

The slider's own narrowing moves from `[min]`/`[max]`/`[step]` in the template to
`narrowedConstraints()`, the channel ADR 0030 established for it: the projection
places those attributes, and a template writing them too leaves two answers whose
order decides which one the user gets.
