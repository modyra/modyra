---
"@modyra/styles": patch
---

The calendar, the clock and the chip list are placed by the contract too

Three more copies of the popup primitive removed from the foundation, following the palette and the
select list. Each said what `.mdy-popup` already says: `position: absolute` at `top: 100%` while
closed, and a sibling rule re-reading every `--mdy-overlay-*` property to switch to `fixed` while
open.

These three put their popup classes on the overlay panel itself, and the panel is a popover — so the
primitive was already placing them through `.mdy-popup[popover]`. The duplicates were not doing
anything; they were merely agreeing.

What survived is what the primitive has no way to know: a picker is content-sized rather than
control-width, and now says so with `--mdy-overlay-width: auto` — one property the primitive reads,
instead of a rule restating placement to change one value in it.

Measured before and after across `modyra`, `modyra-modern`, `modyra-material` and `modyra-ios`, for
all three widgets — position, gap from the control, box, left edge, in-viewport, radius, background
and padding: **byte-identical**, twelve cases out of twelve.

Left standing: the `--overlay` modal blocks, which duplicate the centring the primitive does through
`--mdy-overlay-transform` but also carry the modal's own sizing. That placement needs a viewport with
no room on either side to reach, so it needs its own verification path before being touched.
