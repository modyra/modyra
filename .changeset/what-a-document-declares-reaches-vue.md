---
"@modyra/vue": major
---

What a document declares about a field now reaches the control a person operates, and a panel nobody
opened no longer looks open.

**A slider wrote values its own document forbids.** `min`, `max` and `step` never reached the
`<input type="range">`, so the platform used its own: on a field declared 10–20 by 5, Home wrote 0,
End wrote 100 and one arrow moved by 1 — and the form accepted them, because the control produced
them. It survived because the default hides it: a slider declared 0–100 by 1 behaves identically
whether or not anything was passed, and that is the slider every fixture had.

The route is the contract's. The controller is told the `kind` and the narrowing, and the projection
composes those with the field's own rules onto the control part — so a bound is decided in one place
rather than written onto an element by whichever renderer is drawing. `MdyTextField` takes the same
route, and gains `placeholder`; both take `ariaLabel`, which is the name a control has where nothing
on the page captions it.

**The select was drawn open.** Its panel had no way of being shut, so the list was on the page from
the moment the field was mounted while the trigger said `aria-expanded="false"` — a person looking
saw an open list and a person listening was told it was closed. The other five panel kinds were
already right; all six are now held to it by a check that asks whether the panel is *shown*, not
whether it exists, since every renderer here keeps its panel in the document while shut.

`MdySliderField` and `MdyTextField` gain optional props. Existing call sites compile unchanged; the
surface audit classifies a component's published props moving as major.
