---
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A key belongs to the control that has focus

Commands inside a multiselect — the button that removes a value, the one that clears them all, the
way back — are `<button>` elements, which the platform activates with `Enter` and with `Space`. The
field's own keyboard policy answered those keys as they bubbled past and called `preventDefault` on
them, so the browser drew a focus ring on a control that said it could be operated and then did
nothing. Worse on a chip: the chip's own bindings took `Enter` and did something else with it.

The contract already said whose key it was — the openers' bindings are declared `on: "trigger"` — and
the renderers were applying them wherever the key arrived. Each handler now answers only keys aimed
at its own part; keys inside the popup, where an option *is* a button, are untouched.

Which of the two keys a person uses is not a preference: someone who came from links presses one,
someone who came from forms presses the other, and assistive software sends whichever it was built
around. There is no way to discover from outside which one a control chose.
