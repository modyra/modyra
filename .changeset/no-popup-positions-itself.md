---
"@modyra/styles": patch
---

No popup positions itself any more, and the primitive gained the coordinate it was missing

The last copies of the popup primitive are gone: the `--overlay` blocks that centred a modal
placement with `position: fixed`, `top: 50%`, `left: 50%` and a translate — which is exactly what
`anchorOverlay` writes through `--mdy-overlay-top/left/transform` when it gives up on both sides. The
select's block also carried a `width: min(24rem, 90vw)` that had been dead for some time: the
primitive's `width: var(--mdy-overlay-width)` outranked it.

**Removing them exposed a real gap.** `.mdy-popup` read every coordinate the anchoring writes except
the transform — only `.mdy-overlay` did. A popup that is not also an overlay, which is every one
whose classes sit on the panel, was therefore pinned by its top-left corner to the middle of the
screen instead of centred on it. Measured: the clock at `450,160` in a 900×320 viewport. The
duplicated blocks had been hiding it. `.mdy-popup` reads it now.

Reaching the modal placement takes a viewport with no room on either side — 900×320 does it — which
is why this had gone unmeasured. Before and after, four stylesheets × two widgets docked and modal:
**identical in every case**, twenty measurements.

What survives is what the primitive cannot know: a modal list scrolls as a column
(`display: flex`, `max-height`), and a picker is content-sized rather than control-width
(`--mdy-overlay-width: auto`). Both are said as one property or one intent, not as a rule restating
placement in order to change one value in it.

A grep for a popup class declaring `position`, `top`, `left`, `right`, `bottom`, `inset`, `z-index`
or `transform` in the foundation now returns nothing.
