---
"@modyra/widgets": minor
---

Nest the catalog anatomy (a control now hangs off its wrapper, an error item off the error list)
and mark the control and its container required, then add `assertWidgetDomContract` /
`inspectWidgetDom` to `@modyra/widgets/testing` — a framework-agnostic runtime check that rendered
DOM matches the contract's classes, containment, order and ARIA.
