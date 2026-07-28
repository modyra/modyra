---
"@modyra/widgets": minor
"@modyra/plain": minor
---

Declare outside-pointer dismissal in the contract: every widget that owns an overlay reports
`capabilities.dismissOnOutsidePointer`, and the decision stays `overlayLifecycleTransition`, so a
pointer landing outside closes by default and a popup that should not be dismissible has to say so.
Plain wires it through one shared helper for the select, the pickers, the date range and the colour
palette.
