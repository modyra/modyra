---
"@modyra/styles": patch
---

The multiselect's opener cannot be squeezed to nothing

A person reported not being able to open a multiselect. Measured in a browser: with chips in the row,
the opener is **zero pixels wide** — and every flag a check reads says it is shown. It is in the tree,
`display: flex`, `visibility: visible`, `opacity: 1`, and `getClientRects()` returns one rect. Only
the box says otherwise, which is why no suite caught it: jsdom has no layout to measure, and a
`getClientRects().length` check passes on an empty box.

The cause is arithmetic in the flex row. The chip strip will not shrink below its chips, the opener
had `min-width: 0`, and a flex row gives all its shrinking to whichever child allows it — so the
opener absorbed every pixel and disappeared:

| | opener | chip strip |
| --- | --- | --- |
| no chips | 372px | 0 |
| three chips | **0** | 372px |
| three chips, repaired | 44px | 328px |

The opener now declares the target the design system already asks for, and the strip yields the
difference — which costs it nothing it had not planned for, since it scrolls sideways by design.
Measured across themes: the opener holds 44px in every one, and the no-chips case is unchanged.

**Two rows in the browser tier are red because of this, deliberately, and they are not new defects.**
Both species were already pinned against another renderer: a panel that ignores the floor its kind
declares, and a field that does not fit a narrow screen. Giving the opener a width made Angular
*capable of showing* the first — the spec says so itself: the floor exists for a field too narrow to
be worth matching, and is the only place it does anything, so on a wide field a renderer that honours
it and one that never read it are indistinguishable.

What stays open, stated rather than patched: at 320px a multiselect holding a dozen values overflows
its own edge by 5px, and at that width sideways dragging adds to a page that already scrolls
vertically. Which affordances yield on a narrow screen is a design decision across three renderers,
and it is not one to take at the end of a long session — measured, it is the row itself that does not
fit: opener 44 + way-back 28 + clear-all 28 + arrow 28, in 80px of space.
