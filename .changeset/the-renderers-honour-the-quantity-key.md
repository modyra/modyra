---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Honour the quantity key on an option in an open multiselect

The previous release declared `ArrowRight` and `ArrowLeft` on an option while the panel is open, and
said in as many words that the renderers would honour them in the next one. This is that one: the
number on an option in counter mode can now be changed from a keyboard in all three.

`multiselectOverlayAction` answers the pair with a `step` action carrying the option and the
direction. Both are read from the kind's own declaration rather than named in the policy, so the
keys move in one place; and whether the option carries a quantity at all is read from the variant's
`required` list, where the difference between the two modes is already stated. The input gained an
optional `mode`: without it the policy leaves the key unclaimed, because an option that holds no
number cannot tell a press that changes something from one that changes nothing, and a key answered
with an action that does nothing is worse than a key nothing claims — the caller has already
prevented the platform's own meaning by then.

Angular needed a second repair to honour it at all. Its keydown listener sat on the trigger and the
filter box, so once focus followed the cursor into a row the presses stopped arriving: the first
press worked and the second was lost, because the `−` button is disabled at zero and takes no focus
until there is something to subtract. The options grid now listens too, which is where plain and lit
were already listening.
