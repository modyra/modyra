---
"@modyra/widgets": minor
"@modyra/lit": minor
"@modyra/plain": patch
---

The opener a contract names is the one a keyboard reaches

`MDY_POPUP_OPENERS` names the part that opens each popup. `@modyra/lit` disagreed twice over, and each
half looked defensible alone: its daterange put `aria-expanded` and `aria-haspopup` on **both** date
inputs — two elements describing one popup, neither of them the declared opener, and a text input is a
textbox with nothing to expand — while the toggle that *is* the opener carried `tabindex="-1"`.

Together they closed both doors. Measured across every kind with a popup, offering every key the
contract names to every part a keyboard can reach: plain opens all six, lit opened four. Its daterange
and timepicker could not be opened without a mouse at all.

Now the declared opener carries the state and nothing else does, the toggle is reachable, and lit's
timepicker control answers the keys `MDY_WIDGET_KEYBOARD` publishes — read through `keyBindingFor`
rather than written again in the element.

`aria-haspopup` names what opens: the daterange promises `grid` in both renderers, as its own
projection declares. `@modyra/plain` promised `dialog`; `@modyra/lit` promised it on the inputs.

The daterange projection no longer writes `role="combobox"` on its toggle. The opener table
deliberately declares no role for the kinds whose opener is a button, no renderer consumed the literal
one, and a button whose value lives in the two inputs beside it is not a combobox.
