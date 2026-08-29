---
"@modyra/plain": patch
---

Present when means on the page

Five parts in Plain were built once and hidden: the required marker on a checkbox and a toggle, the
select's value and placeholder, and the multiselect's placeholder. The contract says a part is
present *when* its condition holds, and the other two renderers build these only when they are owed
— so a checker reading the anatomy found a part drawn while its condition was false, and anything
deriving words from a control read a placeholder that was not on screen.

They are added and removed now, in the contract's own reading order.
