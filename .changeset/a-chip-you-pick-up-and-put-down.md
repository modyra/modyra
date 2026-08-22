---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Reordering is a grab, not a modifier

`Alt`+arrow was Back and Forward in every major browser on Windows and Linux. It worked here only
because `preventDefault` suppressed the platform's own gesture, and it taught a keystroke that on any
other focused element throws away the form being filled in.

`Enter` on a chip picks it up, the bare arrows carry it, `Enter` puts it down and `Escape` puts it
back where it was. No modifier, so nothing to collide with on any platform. A grab is also a *state*,
which the modifier could never be: it is announced — "A grabbed, 1 of 3. Use the arrows to move it,
Enter to drop it, Escape to put it back" — and it can be abandoned, which matters most to the person
who picked up the wrong chip.

The arrows are declared once, as what moves the reading position. Held, they carry the chip: the same
movement with the grab's subject rather than the cursor's.

The `open` bindings now name the part they open from. They declared none, so a binding meaning "press
the control to open it" also claimed the chips inside it, and `Enter` on a chip meant both "open the
list" and "pick this up" — decided by whichever handler ran first rather than by the table. A
control-level question still finds them: the part a person opens a kind with is the control, for that
purpose.

Migration: a consumer teaching `Alt`+arrow, or handling `intent: "reorder"` from a key, reads
`intent: "grab"` and moves what is held with the arrows it already handles.
