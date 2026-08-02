---
"@modyra/widgets": minor
---

`@modyra/widgets/testing` states what a form owes when it unmounts.

`MDY_LIFECYCLE_TRANSITIONS` names the nine transitions a form goes through; `inspectUnmount` and
`inspectCoexistence` judge the conditions that only a teardown can violate — DOM left in the
document, ids that still resolve, an effect that still runs after disposal, and ids shared by two
live instances. The document is checked whole rather than under the host, so an overlay that was
portalled out counts.

Listeners and timers are not observable — no DOM implementation exposes a listener registry — so
`REACTIVE_EFFECT_SURVIVED_UNMOUNT` observes the consequence a stray subscription would have instead
of its registration. The substitution is stated rather than implied.

The conditions are meant to run over a loop: a renderer that leaks one node per mount is clean on a
single teardown and ruins a page that lives for an hour.
