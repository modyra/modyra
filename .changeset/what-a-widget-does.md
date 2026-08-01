---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

Milestone B, batch 3: the contract says what a widget *does*.

`MDY_WIDGET_TRANSITIONS` declares, per kind, which user action moves an overlay between open and
closed, and whether closing returns focus to the opener. The anatomy said a select has a popup and
the state contract said it may be open; neither said that clicking the trigger opens it or that
Escape closes it. Those are the parts a user experiences, and they existed only as the behaviour of
two shared functions.

The table is written independently of those functions rather than derived from them — a declaration
read out of the implementation it checks is not a check — and `overlayLifecycleTransition`, which all
three renderers route through, is held to it. `widgetKeyIntent` is held to it too, but that function
has no adapter consumer: every renderer implements its own key handling.

Declaring it alone would have proved nothing, so all three adapters now **replay** the transition
against a real DOM: open the overlay, press Escape where focus actually is, and assert the opener's
`aria-expanded` — the contract's own statement of open-ness, and the one signal every adapter
carries. Five shipped defects turned up, none of them visible to any existing check:

- **Plain's daterange and colours** bound Escape inside a popup that never takes focus, so the
  handler could only fire if the user had already reached into it. Both could be opened from the
  keyboard and not closed.
- **Plain's timepicker** had no Escape handler at all.
- **Lit's multiselect** defined a correct Escape handler and never bound it — unreachable code.
- **Lit's timepicker and colours** had the same popup-only binding as Plain's.

Angular had none: it closes on Escape on every overlay kind.
