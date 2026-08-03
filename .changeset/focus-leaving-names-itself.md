---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

Focus leaving an overlay names itself, and never outranks a pointer.

New capability `dismissOnFocusOutside: boolean`, true wherever there is a popup. It declares what
already happened — Tab out of an open popup closes it — and separates it from
`dismissOnOutsidePointer`, which is a different question with a different answer.

Conflating the two was a real defect: all three renderers could close a popup that the pointer rule
had just refused to close. An interaction begun inside the popup and dragged out moves focus out on
the way, and closing on that reinstates, through the focus path, exactly the dismissal light dismiss
exists to prevent. The precedence is now explicit — while an interaction begun inside is unresolved,
focus decides nothing — and all three renderers consult one rule instead of each deciding.

`@modyra/lit` also loses a `setTimeout(…, 120)` on blur, replaced by the `relatedTarget` containment
check the other two renderers already used. A delay is a guess about how long a click takes to land,
and it raced whatever the pointer did meanwhile.

`touched` still marks when focus leaves, including where the close is suppressed. Being touched is
not a dismissal.
