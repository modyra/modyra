---
"@modyra/plain": patch
---

A minute you can type back into the box

*"Io ho 00, uso tasto back del mac per cancellare e ho solo 0, a quel punto scrivo 1 e ottengo 01."*
It gave `001` instead.

This renderer read its own box, handed the controller a number, and the sync wrote the canonical form
straight back — so a `0` became `00` with the caret after it and the next key landed third: three
digits in a two-digit field, and `01` unreachable by the route a person takes.

The box reports what was typed and the contract decides what it means. The sync leaves a segment alone
while somebody is inside it, and on blur it settles to the canonical form of what the draft holds —
which is `timepickerEntryText`'s answer rather than this renderer's padding.

Measured through the gesture as it was described:

```
00 → Backspace → 0 → type 1 → 01 → Tab → 01      committed 09:01, hand at one minute
```

And the half that makes the rule a hybrid, in the hour box on a 24-hour face: typing `2` moves the
hand to two, and typing `9` after it leaves the hand there — `29` is not an hour, so the box goes on
showing it while the draft does not take it. Committed `02:01`.
