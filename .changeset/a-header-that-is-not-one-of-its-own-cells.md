---
"@modyra/plain": patch
"@modyra/lit": patch
---

A header that is not one of its own cells

plain's calendar header read `2026` while the years were on screen — text identical to one of the
cells under it. Anything looking for the year finds the header first and presses the way back instead
of the year it meant: a person, a test, a tool. It reads the month and year in every view now, which
is what the other renderers of this contract show.

**And a fix from earlier in the night had a corner it did not account for.** lit closes its popup when
focus leaves the element, which is what `dismissOnFocusOutside` asks for — but `relatedTarget: null` is
not focus leaving. Re-rendering removes whatever was focused and blurs it into nowhere, and a calendar
cell replaced when the view changes does exactly that: the popup closed on the click that was
operating it. Focus is only *elsewhere* when it landed somewhere, and the null case belongs to the
keyboard repair beside it.
