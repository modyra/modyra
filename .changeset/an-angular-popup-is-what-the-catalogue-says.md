---
"@modyra/angular": patch
---

The overlay panel takes its role from the catalogue

`MDY_WIDGET_CONTRACTS.multiselect.parts.popup` declares `role="dialog"` — the contract version moved
2 → 3 for it — and this renderer drew a bare `<div>`. Plain and lit took the new contract; Angular
did not, so its multiselect popup carried no role at all and the shared DOM-contract check reported
`PART_ROLE:popup` in three specs.

The panel now asks the catalogue for the popup role of the kind it belongs to, rather than deciding
for itself. The modal rule stays underneath it as the fallback for kinds the catalogue says nothing
about: a panel with a backdrop *and* a name is still announced as a dialog, which is what the palette
and the clock have relied on since the nameless-dialog finding. The multiselect passes a name for the
same reason — a dialog without one is an axe violation, and it was the last failure left after the
role landed.

Swept rather than patched: the shared check runs over all seventeen kinds with no excused
divergences, and the multiselect popup was the only role Angular was missing.
