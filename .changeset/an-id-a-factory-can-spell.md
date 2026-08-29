---
"@modyra/angular": patch
---

An id a factory can spell

Three ids were written with names the contract does not use: `hex` for the `hexInput` part, `start`
and `end` for `startControl` and `endControl`, and `__chiptip` spelled by hand for `chipTooltip`.
Each resolved on the page and none could be derived by the published id factory, so anything building
the same reference from the contract — a check, a fourth renderer, a host reaching for the element —
pointed at nothing.

They are spelled by `defaultWidgetIdFactory.part` from the part's own name now. The ids on the page
change; they are per-instance and referenced through the same factory on both sides.
