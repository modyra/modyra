---
"@modyra/styles": patch
---

An overlay draws one surface, not a wrapper's as well

Reported as visual friction around overlays in some cases. Measured, it is a leak from the UA
stylesheet.

Angular's `<mdy-overlay-panel>` — and Lit's equivalent — puts the **wrapper** in the top layer and
the widget's popup inside it. The wrapper therefore carries `popover`, and with it the UA popover
defaults: `background: canvas` and `padding: 0.25em`. Nothing answered them; the rule that answers
them for a popup is keyed on `.mdy-popup`, which the wrapper is not.

Its only child is `position: fixed` and so out of flow, contributing no height — so the wrapper
collapsed to exactly its own padding: an **opaque bar the popup's full width and 8px tall, painted at
the popup's own origin**. Behind a popup with 10px corners it showed through the corner cutouts,
which is a white notch at each top corner and worse the darker the theme.

Measured before: `background rgb(255,255,255)`, `padding 4px`, box `534×8`. After: transparent,
`0px`, `534×0`, with the popup unchanged at `534×324` and still on its control.

The wrapper now answers the UA popover styles and paints nothing at all. It never had a surface of
its own to draw: the popup inside it already states the background, border, radius, shadow and
padding, and that is the one surface an overlay should have.

Covered by a demo e2e that measures both boxes, because this is exactly the kind of thing that reads
as correct in the markup.
