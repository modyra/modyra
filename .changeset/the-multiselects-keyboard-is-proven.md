---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/angular": patch
---

The multiselect's keyboard contract, held to the same rules as the select's.

`multiselectOverlayAction` had the same two gaps and the same consumption problem:

- **`ArrowDown` on a closed list opens it** — it returned `move`, an action on options nobody can see.
- **`Tab` closes and yields focus**, with `restoreFocus: false`.
- **`@modyra/plain` answered only `Escape`.** No opening, no Tab, no navigation: a list opened with a
  pointer could not be left from the keyboard by any other key. It now dispatches the contract's
  action.
- **`@modyra/angular` bound its key handler to the overlay's input only**, so a *closed* list had no
  keyboard handler at all and could not be opened without a pointer. Found by pressing the key in a
  browser. It also restored focus on every close, ignoring the action's own `restoreFocus`, which
  pulled a tabbing user back into the field they were leaving.

**Recorded, not fixed**: Plain does not dispatch `move` or `select`. Its controller has no active
option to move — the intents are `toggle`, `increment` and `decrement` over chips, with no cursor —
so arrow-key navigation needs that cursor first, which is a controller change and its own batch.
Opening, dismissing and yielding focus map exactly and are wired now.
