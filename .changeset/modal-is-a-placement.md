---
"@modyra/widgets": major
"@modyra/angular": major
"@modyra/lit": major
"@modyra/plain": major
"@modyra/styles": minor
---

Modal is where a popup sits, not when a field commits

`variant: "modal"` did four things at once: a backdrop, a modal header, reading a
**draft** instead of the value, and a Cancel/Confirm row. The first two are
presentation; the last two are commit semantics — and they contradicted the
kind's own value contract, which says `commit: "live"` for both the date picker
and the range picker. The anatomy even declared an `actions` part for them, so
the contract disagreed with itself in writing.

**The placement was already there.** ADR 0023 named it the modal placement
(`placement: "overlay"`) and it was reached only when neither side had room.
`anchorOverlay` now takes `forceModal`, so a host can *ask* for it — one door,
consumed by all three renderers, which already call that function.

**`variant` keeps only its presentation meaning.** The draft, the confirmation
and the `actions` part go: choosing a date writes it, and the second pick of a
range closes and writes it, whatever the placement.

Migration: `variant="modal"` still covers the viewport and still draws the modal
header. A product that relied on Confirm to commit no longer has it — the value
is written when it is chosen, which is what `MDY_VALUE_CONTRACTS` said all along.
`MDY_WIDGET_CONTRACTS.datepicker.parts.actions` and its daterange twin are gone;
the timepicker keeps them, because it is the kind that confirms.

`scripts/audit-commit-affordance.mjs` is the check that would have caught this: a
kind declared `live` may not declare a confirmation part, and no renderer may
draw the classes of one for it. Both halves read from the source of truth, so a
kind that changes its commit mode carries the check with it.
