---
"@modyra/vue": patch
---

A part whose job is to show something shows it: the slider's number, the file field's prompt and the
colour field's swatch.

`@modyra/vue`'s components draw the parts they need by hand, with the projection, and delegate the
rest to a walk over the declared structure. That walk knew the shape and nothing about the value, so
every part it drew was a box with the right classes and nothing inside — and the parts a component
delegates are precisely the ones that *display* a value. The model held the file, the slider held 50,
and a person saw an empty box.

It landed on exactly three kinds for the same reason: where the value lives inside the native control
— text, number, date — the component draws that control itself with the projection, and the defect
cannot appear.

**Measured, and it resizes the repair that was proposed.** The projection does not carry these: the
slider publishes no `value` part, the file field publishes neither `content` nor `clear`, and the
colour field's `preview` carries classes and `aria-hidden` and no colour. Handing the view to the walk
— the obvious fix — would have changed nothing, because there is nothing there to hand over. That gap
is real and stays named: the contract declares parts whose content it does not project, and four
renderers each invent it.

The first repair here supplied the prompt *instead of* the structure beneath it, which deleted the
button that empties the field — and a probe reading a missing element's text as `""` called that a
success. The bench now asserts absent and empty apart.
