---
"@modyra/plain": patch
"@modyra/lit": patch
---

A clock face a keyboard can turn

`@modyra/widgets` publishes both halves of a dial's keyboard — `timepickerDialAria` for what a screen
reader is told and `timepickerDialKeyIntent` for what the keys land on — and neither renderer used
either. The face was a `<div>` of `<div>`s: no role, no value, no name, not focusable, and no key
answered. Setting a time on the clock was a gesture only a pointer could make.

Both now take the face into the tab order, announce it as the slider it is, and turn the hand with
the arrows, `PageUp`/`PageDown`, `Home` and `End` — through the contract's own rule, so what is
announced and where the arrows land cannot drift apart.
