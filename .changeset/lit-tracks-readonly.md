---
"@modyra/lit": patch
---

A Lit control re-renders when the form marks it read-only

`MdyFormController` subscribes to a hand-written list of the field handle's signals, and `readonly`
was not on it. The read-only bindings added in the previous release were therefore correct and
inert: marking a field read-only changed nothing in the DOM until some *other* tracked signal —
a value edit, a validation error, a disabled toggle — happened to fire and drag a re-render with it.

A signal missing from that list does not produce a missing attribute, which is what a conformance
suite looks for. It produces a binding that renders once and then stops tracking, which is harder to
see and easier to trust.

The element's own state matrix could not catch it, because the harness called `requestUpdate()`
before asserting and forced the render it was meant to be testing for. That call is gone: the suite
now waits for the element to update on its own, so an untracked signal fails it.
