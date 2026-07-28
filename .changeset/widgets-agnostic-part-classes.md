---
"@modyra/widgets": minor
"@modyra/plain": minor
---

Name every control's parts in the contract, so a theme has a stable hook for each one and an
adapter never has to invent a class: slider (`mdy-slider-container` / `mdy-slider` /
`mdy-slider-value`), checkbox and toggle (`mdy-checkbox__control`, `mdy-toggle__control`), radio and
segmented (group, option, control, label), select and multiselect (trigger, value, arrow, popup,
search, list, option, chips, chip). The select's filter is now a contract part of its own: it is an
input at the top of the popup, not typing over the trigger, so the committed value stays visible —
Plain renders it that way and the DOM gate accepts a portalled popup as the contract's own portal
capability rather than a containment violation.
