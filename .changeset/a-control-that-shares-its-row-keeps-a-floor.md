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
