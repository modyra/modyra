---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A value the browser restored on Back is adopted, instead of being contradicted

Press Back into a form somebody had started filling in and the browser hands them their typing back.
It writes it straight into the boxes and announces nothing — so the field showed what they had
written while the form still held the value it was built with, and a submit sent the second. There
was no moment at which they could have noticed: every part of the page was individually correct.

The form now adopts what was restored. Where the browser restored nothing — which is the other two
engines, whose restore lands before script-built controls exist — nothing happens, and there is
nothing to disagree about either.

New in `@modyra/widgets`: `adoptHistoryRestore(binding)` and `MdyHistoryRestoreBinding`. Renderers
bind it themselves; a consumer needs it only for a form they build and mount by hand.

**Two visible effects.** After a history traversal, each restored control fires one `input` and one
`change`, and the fields adopted are marked touched — so their validation runs and their errors show.
Both follow from adopting through the same door a person's own typing comes through.

If you want the typing to survive in every browser, configure a `draft`: that already does it. See
ADR 0150.
