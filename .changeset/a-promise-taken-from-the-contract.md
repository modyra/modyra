---
"@modyra/plain": patch
---

The daterange and colours openers take their popup promise from the contract

`aria-haspopup` is announced *with* the control, before anything opens, and a person decides whether
to open it from that word. Nineteen places across three adapters wrote it as a literal and one read
the contract's projection — so two renderers of one widget could say different words about it, and
nothing compared them.

These two now ask: `MDY_POPUP_OPENERS` carries `promises` per kind, and `applyOpenerPromise` reads it
through `projectOverlayOpenerA11y`. The colours field was promising a listbox where the contract says
listbox and the panel renders one, and the daterange a grid — both are now whatever the contract
says, wherever it changes.
