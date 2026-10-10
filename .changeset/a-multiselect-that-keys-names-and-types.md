---
"@modyra/vue": patch
---

`MdyMultiselectField` keys object options by content, names its way back, and answers the keys the contract declares

- Options and held values are matched with `defaultOptionKey`, as the controller keys them.
  Before this, every object value became `[object Object]`, so a held object drew no chip.
- The way-back button carries `wayBackActionName` as its `aria-label` and `title` ("Undo: Roma
  removed"), not a bare "Undo".
- When the panel has no filter box, a letter typed at the open list moves to the option that
  starts with it. Ctrl/Cmd+Z restores what was removed, and the shortcut is left to the page
  when there is nothing to restore.
- The placeholder is drawn only when nothing is held. Each chip draws its count part in both
  modes.

No migration.
