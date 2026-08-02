---
"@modyra/widgets": minor
"@modyra/angular": patch
---

Focus is borrowed, not taken: `createFocusCustodian` makes the handover a contract.

Moving focus is easy and losing it is silent. A widget opens an overlay, focus goes in, the overlay
closes — and if nothing takes focus at that moment the user is standing on `<body>`, at the top of
the document, with no way back to the field they were in. Nothing throws and every attribute is
still correct.

Five of the seven focus behaviours audited across the three renderers were wrong, each in a
different file, each needing its own repair. That is a missing contract, not six careless renderers.

Two halves, both enforced:

- **Focus is recorded before it is moved**, so there is always somewhere to hand it back to.
- **A move that is not taken did not happen.** `focus()` on a detached, hidden or inert element does
  nothing and reports nothing, so every candidate is verified against `activeElement` afterwards and
  a candidate that did not take it falls through. The chain is the caller's preference, then
  whoever held focus before, then the widget itself; focus goes nowhere only when the widget has
  left the document.

**`@modyra/angular`'s `select`, `datepicker` and `daterange` stranded the keyboard on dismissal**, and
now do not. Two earlier attempts failed on a wrong premise worth recording: the overlay renders its
panel *inside* the wrapper rather than portalling it, so "is focus still inside this widget" answered
*yes* for precisely the case that strands people. The panel is what disappears, so the panel is what
is asked about — before containment, not after.

`portalRootFor` moves from `@modyra/widgets/testing` to the package root, since the runtime needs it
too; the testing entry re-exports it rather than keeping a second copy.
