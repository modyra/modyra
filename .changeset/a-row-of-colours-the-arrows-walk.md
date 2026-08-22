---
"@modyra/plain": patch
"@modyra/lit": patch
---

The colour presets answer the keys the catalogue declares for them

`MDY_WIDGET_KEYBOARD` declares the arrows, `Home` and `End` on an open colour field, and neither
renderer answered any of them: the swatches are a listbox and nothing walked it. They do now, in the
direction the binding gives rather than the one the key name suggests, so a row reads correctly in a
right-to-left document.

Focus is unchanged: the contract's canonical observation says a colour overlay leaves focus where it
was, so nothing moves into the row on open.
