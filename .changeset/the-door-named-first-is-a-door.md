---
"@modyra/vue": patch
---

The door the contract names first is a door.

`MDY_POPUP_OPENERS` declares the **control** as the opener for the date and time pickers, with the
toggle beside it as `alsoOpensFrom` — a second way in, not the way in. `@modyra/vue` drew the control
without a handler, so the declared door was dead: a person pressing the field got nothing, and only
the small button beside it worked.

It hid well. Every bench that opens one of these presses `button[aria-expanded]`, because that is what
opens *some* kind everywhere, so the door that worked was the only one anyone tried. It surfaced when
a peer's probe pressed `button, input`, landed on the control, and was about to read a panel that had
never opened as a state.

By key as well as by pointer, because a control that opens only under a pointer is one a keyboard
cannot reach the panel through at all. Which key is asked of the contract, at the part it is declared
on: `Enter` is declared `on: "control"`, and a binding declared on a part is invisible from the widget
— asked without it, the lookup finds nothing.

The press is stopped once it has opened. The root forwards keys into the panel, and this one arrived
there in the same turn — opening, then being read as a move inside the panel it had just opened, which
left the widget shut again.
