---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A choice is said out loud even while the list is open

`multiselectAnnouncement` took an `open` argument and returned nothing while the popup was showing, on
the reasoning that the options there announce themselves and a live region firing too would speak
twice. That holds only for somebody choosing with the **keyboard**, where focus is on the option a
screen reader is reading. A choice made with a pointer moves no focus and announces nothing at all —
so the suppression was silence for exactly the person with no other confirmation, since the chips
strip is the sighted feedback and the only one.

The parameter is removed rather than defaulted, because a caller passing `true` was asking for the
defect. The count is not part of the native announcement either way, and the region says the change
and the new total.
