---
"@modyra/vue": patch
---

`@modyra/vue` shows its panels through `setOverlayOpen`, which is what makes them popovers — and a
popover is what the coordinates they are given actually mean.

Writing `hidden` on the element looks like the same act. It is not: `setOverlayOpen` also puts the
panel in the top layer, and the attribute it sets is what the foundation's
`.mdy-popup[popover] { position: fixed }` matches. `anchorOverlay` measures against the viewport, so
its answer is true only for a box laid out against the viewport. A panel that never became a popover
is laid out against the document, and the same numbers point somewhere else by exactly how far the
page has scrolled — nowhere on a short page, thousands of pixels above the window on a real one.

Reported from the demo, where twenty-two fields stack into a page that scrolls: an open panel landed
2258px above the window. **No bench here could have seen it.** Every fixture mounted one field at the
top of an empty page, where nothing has scrolled and an origin error is worth zero pixels — it landed
in the right place by arithmetic accident. The browser tier now has a fixture that scrolls, and it is
red on all six vue kinds and green on the other three renderers, which is what says the defect is
this package's and not the measurement's.

The door was there and this package was the one not using it: plain, lit and angular all call it.
