---
"@modyra/angular": patch
---

A press on the caret opens the multiselect's list

The caret takes no pointer events — the whole field is what opens the list — so a press aimed at the
one mark a closed field shows lands on the box, and the box has to forward it. Plain and Lit did;
Angular did not, so pointing at the affordance that means *this opens* did nothing, and nothing else
on the field said where to point instead.

Forwarded only when the press landed on the box itself, never when it crossed something on the way
up: a chip is a span, so a test on what was passed lets a chip through and one press both picks a
chip up and opens the list.
