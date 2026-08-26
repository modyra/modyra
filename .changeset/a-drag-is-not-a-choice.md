---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A colour dragged past is not the field's value

The platform's chooser reports a drag with `input` and the choice with `change`. All three renderers
took the value on `input`, so a field recorded colours nobody chose — and abandoning the chooser left
whichever one the pointer had been passing over. The field then held a valid colour that had genuinely
been on the screen a moment earlier: only the person who cancelled could tell, and only if they
remembered what they had.

They take it on `change` now. The requirement that cancelling restore the previous value is met by
there being nothing to restore, and the colour being dragged past is shown by the chooser itself,
which is where the person is looking.

**What this gives up**: the page no longer previews the drag, so a consumer listening for a value
while a person moves through the chooser hears nothing until they settle.

`openPlatformChooser` opens that chooser through `showPicker` where the platform has it. A renderer
may guard the hidden input's click to stop a press on the swatch reaching it twice, and a guarded
click is one the `Custom…` button could not open — a door that says it opens something and does
nothing.
