---
"@modyra/widgets": minor
"@modyra/styles": patch
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A chosen value can be dragged to a new place

The third door onto `move-selected`, and the one the brief named. A keystroke, a tap on the move
controls and a drag now land on the same order because they land on the same intent — none of them can
be repaired into disagreeing with the others.

`chipDropIndex` is the arithmetic, in `@modyra/widgets` rather than in three renderers, for the reason
the dial's angles are: three implementations of "which one is the pointer over" is three answers, and
the one a person meets is whichever adapter their team chose. It reads the chips' midpoints rather
than their edges, so a chip is passed when the pointer is more than halfway across it — what the eye
does — and it takes them in drawing order, so a right-to-left strip needs no special case.

**A press that never travels stays a press.** Six pixels of movement before a gesture becomes a drag,
because treating every press as the start of one takes the chip's own controls away from anybody whose
finger moves slightly. `pointercancel` puts the chip back untouched: the browser taking a gesture is
not a decision the person made.

**The pointer's subject is decided rather than inherited.** A keyboard has continuity for free — focus
travels with the chip, so a second press acts on the chip the first one moved. A pointer has none: after
one move the chip a person was aiming at has slid out from under their finger, and a second press in
the same place moves a different value back where the first one came from. Every pointer move now
names the moved chip as the strip's active one, so everything downstream of the subject points at the
right thing. **The finger still has to re-aim**, which is a property of pointing at a list that
rearranges itself and not something a renderer can fix.
