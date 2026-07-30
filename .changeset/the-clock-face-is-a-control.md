---
"@modyra/widgets": minor
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/plain": patch
"@modyra/styles": patch
---

The clock face is a control, and a time keeps its formalism on screen

Two things a time picker was getting wrong, both now decided once in `@modyra/widgets`.

**The face ignored the format.** `timepickerDialNumbers` always answered 1–12, whatever the picker
was set to — so a 24-hour picker held `14:00` as a value and offered no 14 to point at. The hour was
reachable by typing and by dragging the hand, and not by the control that exists to pick it. A face
that offers twelve hours on a twenty-four hour clock is telling the user something untrue about what
they are editing. It now answers the hours the format has: **1–12 with an AM/PM toggle beside them,
or 0–23 with none**, the second twelve on an inner ring at the same twelve positions, exactly as a
clock has always done. `00` rather than `24`, because midnight is the hour a 24-hour clock names.

**The face had no keyboard at all.** It listened for `mousedown` and `touchstart` and nothing else:
no role, no value, no focus. Every number on it was reachable only by dragging a hand around a
circle — the one gesture a keyboard cannot make and a screen reader cannot describe.
`timepickerDialKeyIntent` is the policy, once: arrows turn the hand clockwise, Home and End go to the
ends of *this* face, PageUp/PageDown turn a quarter of it, and everything **wraps** — a clock is a
ring, and clamping at the end of a circle is the one behaviour a dial cannot justify. It never
produces an hour the format does not have, and the test walks every key from every hour in both
formats to say so.

`timepickerDialAria` gives the face `role="slider"` with the bounds the keyboard uses, so what a
screen reader announces and what the arrows reach cannot drift apart — asserted against each other
rather than written twice.

Angular leads and Lit and plain call the same function, so all three faces show the same hours.
Clicking a number also stopped calling every hour a 12-hour one, which turned every afternoon on a
24-hour face into a morning.

`inner` joins the state vocabulary and the `dialNumber` part declares it, so the ring a renderer drew
a number on is named by the contract rather than spelled in three templates.

Recorded while here: the golden audit walks `.ts` files only, and this widget keeps its template in a
separate `.html`. Everything that clock renders — including the ARIA added here — is invisible to it.
