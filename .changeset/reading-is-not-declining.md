---
"@modyra/lit": patch
---

A required field nobody has reached stops calling itself wrong

Three controls asked the wrong one of two doors for the same verdict. One filters refusals by whether
the field is out of play; the other also asks whether anybody has been at the field. On a touched
field they agree, which is why the wrong one survived — and on an untouched one a required select, a
required dropdown and a required radio group announced themselves invalid on the first paint. That is
the exact behaviour ADR 0165 was written to stop, in the renderer whose adoption produced it.

They ask the same question the native control beside them was already asking.

The check runs over every kind that can be required and empty, and carries its own perimeter: each
kind must still be able to say a field is wrong, so a renderer that never writes the attribute cannot
pass by staying quiet.

Recorded alongside it, in ADR 0167: **a form speaks when the value has been touched, never when only
focus has.** Tab is how a person reads a form, and reading is not declining. This release does not
implement that — the verdict still keys off `touched` rather than `dirty`, so an ordinary field
focused and left without typing still speaks — but the direction is now written down, with what it
would take, so the next person who finds one kind silent where another speaks knows which one is
wrong.
