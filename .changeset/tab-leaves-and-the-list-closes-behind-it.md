---
"@modyra/widgets": minor
---

`Tab` is declared, and opening a list has one owner again.

`MDY_WIDGET_KEYBOARD` never declared `Tab`, so `keyBindingFor` and `widgetKeyIntent` both answered
`null` for it — while `selectKeyboardAction` and its multiselect counterpart closed on it. Two
contract paths to one key, disagreeing: a renderer built from the declared bindings left a popup
floating over a form the user had already tabbed out of, and one that called the policy did not.

`Tab` now closes on all six overlay kinds. `MdyKeyBinding` gains `restoresFocus`, because the two
dismissals genuinely differ and the difference cannot be inferred from the intent: Escape means *put
me back where I was* and returns focus to the opener, while Tab is already carrying focus to the next
control and pulling it back would trap the user in the field they just left. Escape keeps
`restoresFocus: true`; only Tab is `false`.

**Opening on `ArrowDown` had two implementations.** The keyboard policy answers a collapsed combobox
with `open`, and `createSelectController` *also* opened whenever it received a `move` while closed —
an intent the policy never sends. Either could be removed with the widget still behaving, which is
what made the pair invisible: the suite stayed green on a rule the contract had stopped stating. The
controller now treats a `move` on a closed list as the no-op the policy already says it is, and
opening belongs to the policy alone.
