---
"@modyra/lit": patch
---

Every Lit overlay dismisses on a pointer outside it

The dropdown base flipped its own `_open` flag on an outside pointer without telling the widget
controller underneath it, so the select reopened on the next update when the flag was read back
from the controller. The base now asks the policy whether the pointer dismisses and closes through
`close()`, which each subclass already overrides to close its controller.

A Lit multiselect also opens from its trigger, not only from the search affordance, matching every
other widget in the catalog. The conformance suite now enumerates every kind whose contract
declares `dismissOnOutsidePointer` instead of checking one hand-picked element.
