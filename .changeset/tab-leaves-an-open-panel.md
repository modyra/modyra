---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

Tab leaves an open list and lands on the next field

The policy has always answered Tab with *close, and do not restore focus* — let it go where it was
headed. Measured on a page, no renderer did that. Plain put focus back on the trigger, so leaving took
two presses and the first one went **backwards** onto the control being left. Lit and Angular put it
on the document body, from which the next press starts again at the top of the document: the person
has lost their place in the form and nothing said why.

The body case is nobody's decision. The panel closes while the focused element is inside it, the
browser is left with an active element that no longer exists, and it falls back to the body.

**So the rule is an order, not a destination.** `stepOutOfOverlay` moves the focus to the opener and
closes after. The opener is crossed, not stopped at: the key's default is left alone, so the browser's
own Tab carries on from a control that still exists — and from a control it knows what the next one
is, where from inside a panel drawn outside the field it does not.

Tab does not choose. A highlighted option stays unchosen: a shortcut that commits on the way out
removes the ability to leave without choosing.

Plain and Lit are measured landing on the next field, in one press. **Angular is not fixed here.** Its
panel resisted three containment tests and `stepOutOfOverlayByTab` never fired — a measurement, not a
guess — so the attempt was withdrawn rather than shipped on a fourth guess about where its panel
lives.

The check is on the sequence rather than the destination. One that read only where focus ended would
pass an implementation that closes first and focuses after, which works in a fixture and not on a
page, because on a page the browser has already decided by then.
